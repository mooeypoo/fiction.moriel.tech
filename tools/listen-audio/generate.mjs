// Generates Listen audio for the built posts (docs/AUDIO.md).
//
//   node --experimental-strip-types generate.mjs [--dist ../../dist] [--out out] [--from <url>] [--regenerate <slugs|all>] [--plan] [slug...]
//
// Audio is generated per paragraph and stored as segments named by what they sound like, so an
// edit only regenerates the paragraphs that changed; each post's MP3 is its segments joined.
// --from downloads the published segments first. Naming slugs limits the run to those posts
// (a local preview) and skips pruning. --plan only reports what would be generated or removed.
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { Mp3Encoder } from '@breezystack/lamejs'
import { env } from '@huggingface/transformers'
import { KokoroTTS } from 'kokoro-js'
import { parseHTML } from 'linkedom'
import { getSpokenBlocks, hashSpokenText } from '../../src/lib/listen-text.ts'

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX'
// Pinned so a change upstream can't silently alter (or compromise) the generated audio.
const MODEL_REVISION = '1939ad2a8e416c0acfeecc08a694d14ef25f2231'
const VOICE = 'af_heart'
const SAMPLE_RATE = 24000
const BITRATE_KBPS = 48
const PAUSE_AFTER_TITLE = 0.9
const PAUSE_BETWEEN_BLOCKS = 0.55
// Kokoro silently truncates input past ~510 phoneme tokens, so long paragraphs are generated in parts.
const MAX_PART_LENGTH = 300
// Measured on GitHub's runners for blog.moriel.tech (375 paragraphs in about 38 minutes).
const SECONDS_PER_PARAGRAPH_ON_CI = 6

const { values: options, positionals: onlySlugs } = parseArgs({
  allowPositionals: true,
  options: {
    dist: { type: 'string', default: '../../dist' },
    out: { type: 'string', default: 'out' },
    from: { type: 'string' },
    regenerate: { type: 'string', default: '' },
    plan: { type: 'boolean', default: false },
  },
})
const distDir = resolve(options.dist)
const outDir = resolve(options.out)
const segmentsDir = join(outDir, 'segments')
const forced = new Set(options.regenerate.split(/[\s,]+/).filter(Boolean))
mkdirSync(segmentsDir, { recursive: true })

env.cacheDir = resolve(import.meta.dirname, '.cache')
env.remotePathTemplate = `{model}/resolve/${MODEL_REVISION}/`

/** Everything that changes how a paragraph sounds is in its name, so a match can be reused as is. */
function segmentName(text, isTitle) {
  const pause = isTitle ? PAUSE_AFTER_TITLE : PAUSE_BETWEEN_BLOCKS
  const key = JSON.stringify([MODEL_REVISION, VOICE, SAMPLE_RATE, BITRATE_KBPS, pause, text])
  return `${createHash('sha256').update(key).digest('hex').slice(0, 20)}.mp3`
}

function splitIntoParts(text) {
  if (text.length <= MAX_PART_LENGTH) return [text]
  const pieces = (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text])
    .flatMap((piece) => (piece.length <= MAX_PART_LENGTH ? [piece] : piece.split(/(?<=[,;:])\s+/)))
    .flatMap((piece) => (piece.length <= MAX_PART_LENGTH ? [piece] : piece.split(/\s+/)))
    .map((piece) => piece.trim())
    .filter(Boolean)
  const parts = []
  for (const piece of pieces) {
    const last = parts.at(-1)
    if (last !== undefined && last.length + 1 + piece.length <= MAX_PART_LENGTH) parts[parts.length - 1] = `${last} ${piece}`
    else parts.push(piece)
  }
  return parts
}

function encodeMp3(samples) {
  const pcm = Int16Array.from(samples, (sample) => Math.max(-1, Math.min(1, sample)) * 32767)
  const encoder = new Mp3Encoder(1, SAMPLE_RATE, BITRATE_KBPS)
  const chunks = []
  for (let i = 0; i < pcm.length; i += 1152) chunks.push(encoder.encodeBuffer(pcm.subarray(i, i + 1152)))
  chunks.push(encoder.flush())
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
}

// MPEG-2 Layer III, as lamejs writes at 24 kHz: 576 samples per frame.
const MPEG2_L3_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
const MPEG2_SAMPLE_RATES = [22050, 24000, 16000]

/** Exact playing time, counted frame by frame, so joined segments give exact paragraph start times. */
function mp3Duration(buffer) {
  let offset = 0
  let seconds = 0
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff || (buffer[offset + 1] & 0xf6) !== 0xf2) throw new Error(`Unexpected MP3 frame at byte ${offset}`)
    const bitrate = MPEG2_L3_BITRATES[buffer[offset + 2] >> 4] * 1000
    const sampleRate = MPEG2_SAMPLE_RATES[(buffer[offset + 2] >> 2) & 3]
    const padding = (buffer[offset + 2] >> 1) & 1
    offset += Math.floor((72 * bitrate) / sampleRate) + padding
    seconds += 576 / sampleRate
  }
  return seconds
}

let tts
async function synthesizeSegment(text, isTitle) {
  tts ??= await KokoroTTS.from_pretrained(MODEL, { dtype: 'fp32', device: 'cpu' })
  const parts = []
  for (const part of splitIntoParts(text)) parts.push((await tts.generate(part, { voice: VOICE })).audio)
  parts.push(new Float32Array(Math.round(SAMPLE_RATE * (isTitle ? PAUSE_AFTER_TITLE : PAUSE_BETWEEN_BLOCKS))))
  const samples = new Float32Array(parts.reduce((length, part) => length + part.length, 0))
  let offset = 0
  for (const part of parts) {
    samples.set(part, offset)
    offset += part.length
  }
  return encodeMp3(samples)
}

async function download(path) {
  const response = await fetch(new URL(path, options.from))
  if (response.status === 404) return undefined
  if (!response.ok) throw new Error(`Downloading ${path} from ${options.from} failed: ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

// What the site would read: the player is absent on pieces with `listen: false`.
const posts = new Map()
for (const slug of readdirSync(join(distDir, 'pieces'))) {
  const page = join(distDir, 'pieces', slug, 'index.html')
  if (!existsSync(page)) continue
  const { document } = parseHTML(readFileSync(page, 'utf8'))
  if (!document.querySelector('[data-listen]')) continue
  const texts = getSpokenBlocks(document).map((block) => block.text)
  posts.set(slug, { texts, hash: await hashSpokenText(texts) })
}

const manifestPath = join(outDir, 'manifest.json')
const emptyManifest = { model: `${MODEL}@${MODEL_REVISION}`, posts: {} }
let published = emptyManifest
if (options.from) published = JSON.parse((await download('manifest.json'))?.toString() ?? 'null') ?? emptyManifest
else if (existsSync(manifestPath)) published = JSON.parse(readFileSync(manifestPath, 'utf8'))
const publishedSegments = new Set(Object.values(published.posts).flatMap((entry) => entry.segments ?? []))

const selected = [...posts.keys()].filter((slug) => onlySlugs.length === 0 || onlySlugs.includes(slug))
const manifest = { model: `${MODEL}@${MODEL_REVISION}`, posts: onlySlugs.length > 0 ? { ...published.posts } : {} }
const report = []

for (const slug of selected) {
  const { texts, hash } = posts.get(slug)
  const regenerate = forced.has('all') || forced.has(slug)
  const segments = texts.map((text, index) => ({ text, isTitle: index === 0, name: segmentName(text, index === 0) }))
  let generatedCount = 0
  const started = Date.now()

  for (const segment of segments) {
    const path = join(segmentsDir, segment.name)
    if (!regenerate && existsSync(path)) continue
    if (!regenerate && options.from && publishedSegments.has(segment.name)) {
      if (options.plan) continue
      const data = await download(`segments/${segment.name}`)
      if (data) {
        writeFileSync(path, data)
        continue
      }
    }
    generatedCount++
    if (options.plan) continue
    writeFileSync(path, await synthesizeSegment(segment.text, segment.isTitle))
    // Long runs otherwise print nothing for hours.
    if (generatedCount % 10 === 0) console.log(`${slug}: ${generatedCount} paragraphs generated so far`)
  }
  if (generatedCount > 0 && !options.plan) {
    console.log(`${slug}: generated ${generatedCount} of ${segments.length} paragraphs in ${Math.round((Date.now() - started) / 1000)}s`)
  }
  if (generatedCount > 0) report.push({ slug, generatedCount, total: segments.length })
  if (options.plan) continue

  const buffers = segments.map((segment) => readFileSync(join(segmentsDir, segment.name)))
  const starts = []
  let duration = 0
  for (const buffer of buffers) {
    starts.push(Math.round(duration * 100) / 100)
    duration += mp3Duration(buffer)
  }
  const file = `${slug}-${hash.slice(0, 12)}.mp3`
  writeFileSync(join(outDir, file), Buffer.concat(buffers))
  manifest.posts[slug] = {
    hash,
    voice: VOICE,
    file,
    duration: Math.round(duration * 100) / 100,
    starts,
    segments: segments.map((segment) => segment.name),
  }
}

const removed = onlySlugs.length > 0 ? [] : Object.keys(published.posts).filter((slug) => !posts.has(slug))

const describe = ({ slug, generatedCount, total }) => `${slug} (${generatedCount} of ${total} paragraphs)`

if (options.plan) {
  console.log(`Would generate: ${report.map(describe).join(', ') || 'nothing'}. Would remove: ${removed.join(', ') || 'none'}.`)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, planSummary())
  process.exit(0)
}

function planSummary() {
  if (report.length === 0 && removed.length === 0) return '### Listen audio\n\nNo audio changes after merge: every post\'s audio is already published.\n'
  const paragraphs = report.reduce((sum, item) => sum + item.generatedCount, 0)
  const minutes = Math.max(1, Math.round((paragraphs * SECONDS_PER_PARAGRAPH_ON_CI) / 60))
  return [
    '### Listen audio after merge',
    '',
    ...report.map((item) => `- Generate **${item.slug}**: ${item.generatedCount} of ${item.total} paragraphs`),
    ...removed.map((slug) => `- Remove **${slug}**`),
    '',
    paragraphs > 0 ? `About ${minutes} min on GitHub's runners; until then, these posts use the browser voice.` : '',
    '',
  ].join('\n')
}

// Keep only what the manifest references; the deployed site is exactly this folder.
const referenced = new Set(Object.values(manifest.posts).flatMap((entry) => [entry.file, ...entry.segments]))
for (const name of readdirSync(outDir)) {
  if (name.endsWith('.mp3') && !referenced.has(name)) rmSync(join(outDir, name))
}
for (const name of readdirSync(segmentsDir)) {
  if (!referenced.has(name)) rmSync(join(segmentsDir, name))
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
writeFileSync(join(outDir, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Listen audio</title><p>Audio for the Listen player on <a href="https://fiction.moriel.tech">fiction.moriel.tech</a>.</p>\n')

const changed = JSON.stringify(manifest.posts) !== JSON.stringify(published.posts)
console.log(`Generated: ${report.map(describe).join(', ') || 'nothing'}. Removed: ${removed.join(', ') || 'none'}.`)
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`)
