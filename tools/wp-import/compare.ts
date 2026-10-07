// Compares each published post as WordPress rendered it (wpautop of the export) with the built
// page in dist/, line by line: paragraph/stanza breaks, line breaks, scene breaks, and text.
// Usage: npm run build (in the site), then npm run compare -- <export.xml>
// Writes comparison.md; exits non-zero if a poem's lines or stanzas differ.
import { readFileSync, writeFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { wpautop } from './wpautop.ts'
import { readWxr } from './wxr.ts'

const DIST = new URL('../../dist/pieces/', import.meta.url)
const BLOCK = /^(P|DIV|ASIDE|BLOCKQUOTE|H[1-6]|LI|UL|OL)$/
const BREAK = '¶'
const SCENE = '⁂'

/**
 * The Markdown processor curls quotes and turns -- into dashes, as WordPress's wptexturize
 * did on the live site. The comparison ignores typography and looks at words and structure.
 */
function typography(text: string) {
  return text
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/\s*[—–]\s*|--/g, ' - ')
    .replace(/…/g, '...')
}

/** A flat stream: one token per line, BREAK between blocks, SCENE for scene breaks. */
function tokens(root: Element) {
  const out: string[] = []
  let line = ''
  let lines: string[] = []

  const endLine = () => {
    const text = typography(line).replace(/[\s ]+/g, ' ').trim()
    if (text) lines.push(text)
    line = ''
  }
  const endBlock = () => {
    endLine()
    if (!lines.length) return
    // WordPress wrote scene breaks as a "* * *" or "--" line at the top of a paragraph.
    if (lines[0] === '* * *' || lines[0] === '--') {
      out.push(SCENE)
      lines.shift()
    }
    if (lines.length) out.push(...lines, BREAK)
    lines = []
  }
  const walk = (node: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) line += child.textContent
      else if (child.nodeName === 'BR') endLine()
      else if (child.nodeName === 'HR') {
        endBlock()
        out.push(SCENE)
      } else if (BLOCK.test(child.nodeName)) {
        endBlock()
        walk(child)
        endBlock()
      } else if (child.nodeType === 1) walk(child)
    }
  }
  walk(root)
  endBlock()
  return out
}

/** Longest-common-subsequence diff of two token streams. */
function diff(a: string[], b: string[]) {
  const table = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const changes: string[] = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++
      j++
    } else if (j < b.length && (i === a.length || table[i][j + 1] >= table[i + 1][j])) changes.push(`+ ${b[j++]}`)
    else changes.push(`- ${a[i++]}`)
  }
  return changes
}

function body(html: string) {
  return parseHTML(`<!doctype html><html><body>${html}</body></html>`).document.body
}

function shape(stream: string[]) {
  const blocks = stream.filter((token) => token === BREAK).length
  const lines = stream.filter((token) => token !== BREAK && token !== SCENE).length
  const scenes = stream.filter((token) => token === SCENE).length
  return { blocks, lines, scenes }
}

function sideBySide(original: string[], built: string[]) {
  const rows = ['| WordPress (original) | Built site |', '|---|---|']
  const cell = (token = '') => (token === BREAK ? '*(stanza break)*' : token === SCENE ? '*(scene break)*' : token.replaceAll('|', '\\|'))
  for (let i = 0; i < Math.max(original.length, built.length); i++) {
    const mark = original[i] === built[i] ? '' : ' ⚠️'
    rows.push(`| ${cell(original[i])} | ${cell(built[i])}${mark} |`)
  }
  return rows.join('\n')
}

const exportPath = process.argv[2]
if (!exportPath) throw new Error('Usage: npm run compare -- <export.xml>')

const posts = readWxr(exportPath).filter((item) => item.type === 'post' && item.status === 'publish')
const summary = ['| Piece | Type | Paragraphs/stanzas | Lines | Scene breaks | Differences |', '|---|---|---|---|---|---|']
const details: string[] = []
const poems: string[] = []
let poemFailures = 0

for (const post of posts) {
  const original = tokens(body(wpautop(post.content)))
  const page = parseHTML(readFileSync(new URL(`${post.slug}/index.html`, DIST), 'utf8')).document
  const built = tokens(page.querySelector('.post-content')!)
  const changes = diff(original, built)
  const [o, b] = [shape(original), shape(built)]
  const isPoem = post.categories.includes('poem')
  const fmt = (x: number, y: number) => (x === y ? `${x}` : `${x} → ${y}`)

  summary.push(
    `| ${post.slug} | ${isPoem ? 'poem' : 'prose'} | ${fmt(o.blocks, b.blocks)} | ${fmt(o.lines, b.lines)} | ${fmt(o.scenes, b.scenes)} | ${changes.length ? `${changes.length} lines` : 'none'} |`,
  )
  if (changes.length) details.push(`### ${post.slug}\n\n\`\`\`diff\n${changes.join('\n')}\n\`\`\``)

  if (isPoem) {
    // The poem itself is everything before its closing scene break and notes.
    const poemPart = (stream: string[]) => stream.slice(0, stream.indexOf(SCENE) === -1 ? undefined : stream.indexOf(SCENE))
    const [op, bp] = [poemPart(original), poemPart(built)]
    if (op.join('\n') !== bp.join('\n')) poemFailures++
    poems.push(`### ${post.title}\n\n${op.join('\n') === bp.join('\n') ? '✅ identical' : '❌ differs'}: ${shape(op).lines} lines in ${shape(op).blocks} stanzas\n\n${sideBySide(op, bp)}`)
  }
}

writeFileSync(
  new URL('comparison.md', import.meta.url),
  [
    '# WordPress vs. built site',
    'Generated by `compare.ts`. "Lines" are text lines between line breaks; "−" lines exist only in WordPress, "+" only on the new site.',
    '## Summary',
    summary.join('\n'),
    '## Poems, line by line',
    ...poems,
    '## Every difference',
    ...details,
  ].join('\n\n') + '\n',
)
console.log(summary.join('\n'))
console.log(`\nPoems with differences: ${poemFailures}. Full report: tools/wp-import/comparison.md`)
process.exitCode = poemFailures ? 1 : 0
