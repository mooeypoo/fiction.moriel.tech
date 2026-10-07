// What the Listen player reads, shared by the player (browser DOM) and the audio generator
// (linkedom over the built pages), so both derive the same text and the same hash.
// Adapted from blog.moriel.tech; changing it invalidates every piece's audio (docs/AUDIO.md).
import { normalizeForSpeech } from './speech.ts'

/** Where the Listen audio workflow publishes (docs/AUDIO.md). */
export const AUDIO_BASE_URL = 'https://mooeypoo.github.io/fiction.moriel.tech/'

const READABLE = 'p, h2, h3, h4, h5, h6, li, blockquote'
const SKIPPED = '.sr-only, pre'
const LINE_BREAK = ' '
// A line already ending like this pauses on its own.
const ENDS_WITH_PAUSE = /[.,;:!?…—–-]["”’)\]]*$/

export interface SpokenBlock {
  element: Element
  text: string
}

/**
 * A block's text on one line. Line breaks (poem lines) that don't end in punctuation get a
 * comma, so the voice pauses where the line ends instead of running into the next one.
 */
function readableText(element: Element) {
  const clone = element.cloneNode(true) as Element
  clone.querySelectorAll(SKIPPED).forEach((node) => node.remove())
  clone.querySelectorAll('br').forEach((br) => br.replaceWith(element.ownerDocument.createTextNode(LINE_BREAK)))
  const lines = (clone.textContent ?? '')
    .split(LINE_BREAK)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return lines.map((line, index) => (index < lines.length - 1 && !ENDS_WITH_PAUSE.test(line) ? `${line},` : line)).join(' ')
}

/** The piece's title, then its text one block at a time, normalized for speech. */
export function getSpokenBlocks(root: ParentNode): SpokenBlock[] {
  const title = root.querySelector('.piece-header h1')
  const article = root.querySelector('.piece-content')
  if (!title || !article) return []

  const elements = [title]
  for (const element of article.querySelectorAll(READABLE)) {
    // Read nested blocks (a paragraph inside a blockquote) once, through the outer one.
    if (element.parentElement?.closest(READABLE) || element.closest(SKIPPED)) continue
    elements.push(element)
  }
  return elements
    .map((element) => ({ element, text: normalizeForSpeech(readableText(element)) }))
    .filter((block) => block.text)
}

/** Audio is tied to this; any change to the spoken text makes published audio stale. */
export async function hashSpokenText(texts: string[]) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(texts)))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export interface AudioManifestEntry {
  hash: string
  voice: string
  /** Relative to AUDIO_BASE_URL. */
  file: string
  /** Seconds. */
  duration: number
  /** Start time in seconds of each spoken block, in order. */
  starts: number[]
  /** Per-paragraph audio the file is joined from; the generator reuses unchanged ones. */
  segments: string[]
}

export interface AudioManifest {
  model: string
  posts: Record<string, AudioManifestEntry>
}
