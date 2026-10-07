// Converts the WordPress export into src/content/pieces/*.md and src/content/pages/about.md.
// Usage: npm run import -- <export.xml>
// Writes report.json (everything removed or rewritten) and urls.json (old URLs, for redirects).
import { mkdirSync, writeFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import TurndownService from 'turndown'
import { wpautop } from './wpautop.ts'
import { readWxr, type WxrItem } from './wxr.ts'

const ROOT = new URL('../../', import.meta.url)
const PIECES_DIR = new URL('src/content/pieces/', ROOT)
const PAGES_DIR = new URL('src/content/pages/', ROOT)
const OLD_HOST = 'lit.smarterthanthat.com'

// [amazon_enhanced] widgets become plain links to the book (ASINs looked up on Open Library).
const BOOKS: Record<string, string> = {
  '0393308839': 'Found in <a href="https://www.amazon.com/dp/0393308839">Flash Fiction: Very Short Stories</a>, edited by James Thomas, Denise Thomas, and Tom Hazuka.',
  '0812968875': 'Found in <a href="https://www.amazon.com/dp/0812968875">Poetry 180: A Turning Back to Poetry</a>, edited by Billy Collins.',
}

// Titles that carried a status; it moves to the `note` field.
const TITLE_NOTES: [RegExp, string][] = [[/\s*\(Working Draft\)\s*$/i, 'Working draft']]

// Edits Moriel asked for: the site has no comments, so text inviting them goes.
const CONTENT_EDITS: { slug: string; from: string; to: string }[] = [
  { slug: 'telemarketing-call-from-hell', from: 'Based on existing comments, I am', to: 'I am' },
  {
    slug: 'telemarketing-call-from-hell',
    from: 'send it out to the world and get some feedback on it.',
    to: 'send it out to the world.',
  },
  {
    slug: 'telemarketing-call-from-hell',
    from: "<p>Please feel free to comment, make suggestions, and tell me what worked for you and what didn't. Hopefully this will let me rewrite and reorganize this short story into a much better and less rushed piece that you can all enjoy!</p>\n",
    to: '',
  },
  { slug: 'telemarketing-call-from-hell', from: 'Thanks in advance and enjoy the reading!', to: 'Enjoy the reading!' },
]

const EXCERPT_MAX = 300

interface Report {
  images: { slug: string; src: string; description: string }[]
  removed: { slug: string; what: string }[]
  rewritten: { slug: string; what: string; count: number }[]
  skipped: { slug: string; title: string; reason: string }[]
}

const report: Report = { images: [], removed: [], rewritten: [], skipped: [] }

function count(slug: string, what: string, n: number) {
  if (n) report.rewritten.push({ slug, what, count: n })
}

/** Rewrites WordPress-specific markup in the wpautop'd HTML into plain, portable HTML. */
function cleanHtml(slug: string, input: string) {
  let html = input
  for (const edit of CONTENT_EDITS.filter((edit) => edit.slug === slug)) {
    if (!html.includes(edit.from)) throw new Error(`${slug}: text to edit not found: ${edit.from}`)
    html = html.replace(edit.from, edit.to)
    report.rewritten.push({ slug, what: `edited: "${edit.from.replace(/<[^>]+>/g, '').trim()}" → "${edit.to}"`, count: 1 })
  }
  const replace =(pattern: RegExp, replacement: string | ((...args: string[]) => string), what: string) => {
    count(slug, what, html.match(pattern)?.length ?? 0)
    html = html.replace(pattern, replacement as string)
  }

  // Captioned images: the whole shortcode goes; its image is reported below.
  html = html.replace(/\[caption[^\]]*caption="([^"]*)"[^\]]*\]([\s\S]*?)\[\/caption\]/g, (_, caption: string, inner: string) => {
    const src = /src="([^"]+)"/.exec(inner)?.[1] ?? ''
    report.images.push({ slug, src, description: `captioned "${caption}"` })
    return ''
  })

  replace(
    /<p>(?:<em>)?\[amazon_enhanced asin="(\w+)" \/\](?:<br \/>\s*)?(?:<\/em>)?<\/p>/g,
    (_, asin) => {
      if (!BOOKS[asin]) throw new Error(`${slug}: unknown ASIN ${asin}`)
      return `<p><em>${BOOKS[asin]}</em></p>`
    },
    'Amazon widget → book link',
  )

  // Scene breaks, written several ways over the years, become <hr>.
  replace(/<p><center><span[^>]*>\* \* \*<\/span><\/center>/g, '<hr />\n<p>', 'centered * * * → scene break')
  replace(/<p><strong>\* \* \*<\/strong><br \/>\n/g, '<hr />\n<p>', '* * * → scene break')
  replace(/<p><strong>\* \* \*<br \/>\n<\/strong>/g, '<hr />\n<p>', '* * * → scene break')
  replace(/<p>\* \* \*<br \/>\n/g, '<hr />\n<p>', '* * * → scene break')
  replace(/<p>\* \* \*<\/p>/g, '<hr />', '* * * → scene break')
  replace(/<p>--<br \/>\n/g, '<hr />\n<p>', '-- separator → scene break')

  // Empty spacer paragraphs and stray non-breaking spaces at paragraph edges.
  replace(/<p>&nbsp;<\/p>\n?/g, '', 'empty &nbsp; paragraph removed')
  replace(/<p>&nbsp;<br \/>\n/g, '<p>', 'leading &nbsp; line removed')
  replace(/\s*&nbsp;<\/p>/g, '</p>', 'trailing &nbsp; removed')

  // A <br> that ends a paragraph would become a literal backslash in Markdown.
  replace(/<br \/>\s*(<!--more-->)?\s*((?:<\/(?:em|strong|span)>)*)<\/p>/g, '$1$2</p>', 'trailing line break removed')

  // Telemarketing's author's note box, and a bare <div> wrapper (Heat).
  replace(/<div class='notice'>([\s\S]*?)<\/div>/g, '<aside class="author-note">$1</aside>', 'notice box → author-note aside')
  replace(/<\/?div>/g, '', 'bare <div> unwrapped')
  replace(/<h4>/g, '<h2>', 'h4 → h2 (the page title is the only h1)')
  replace(/<\/h4>/g, '</h2>', 'h4 → h2 (closing)')
  replace(/<span style="font-size: 80%;">([\s\S]*?)<\/span>/g, '<small>$1</small>', 'small-print span → <small>')

  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`)
  const body = document.body

  for (const img of [...body.querySelectorAll('img')]) {
    const description = img.getAttribute('title') || img.getAttribute('alt') || '(no alt text)'
    report.images.push({ slug, src: img.getAttribute('src') ?? '', description })
    const link = img.parentElement?.tagName === 'A' ? img.parentElement : undefined
    ;(link ?? img).remove()
  }

  // Credits for images that are gone.
  for (const p of [...body.querySelectorAll('p')]) {
    if (/^\s*Photo Credit:/i.test(p.textContent ?? '')) {
      report.removed.push({ slug, what: `image credit: "${p.textContent!.trim()}"` })
      p.remove()
    }
  }

  for (const link of body.querySelectorAll('a')) {
    link.removeAttribute('target')
    link.removeAttribute('rel')
    if ((link.getAttribute('href') ?? '').includes(OLD_HOST)) throw new Error(`${slug}: link to the old site: ${link.getAttribute('href')}`)
  }
  // Heat's <div> held its first paragraph without a <p>; wrap loose text the way browsers showed it.
  let loose: ChildNode[] = []
  const wrapLoose = (before: ChildNode | null) => {
    if (loose.some((node) => node.textContent?.trim())) {
      const p = document.createElement('p')
      body.insertBefore(p, before)
      p.append(...loose)
      count(slug, 'loose text wrapped in a paragraph', 1)
    }
    loose = []
  }
  for (const node of [...body.childNodes]) {
    if (/^(P|HR|H[1-6]|BLOCKQUOTE|ASIDE|UL|OL)$/.test(node.nodeName)) wrapLoose(node)
    else loose.push(node)
  }
  wrapLoose(null)

  for (const p of [...body.querySelectorAll('p')]) {
    // A removed image can leave its line break behind, which Markdown would show as a backslash.
    while (p.firstChild && (p.firstChild.nodeName === 'BR' || (p.firstChild.nodeType === 3 && !p.firstChild.textContent?.trim()))) {
      p.firstChild.remove()
    }
    if (!p.textContent?.trim()) p.remove()
  }

  html = body.innerHTML
  const leftover = /\[\/?[a-z_]+(?:\s[^\]]*)?\]|<center|<div|<span|<img/i.exec(html)
  if (leftover) throw new Error(`${slug}: unconverted markup: ${leftover[0]}`)
  return html
}

function createTurndown() {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    hr: '* * *',
    emDelimiter: '*',
    strongDelimiter: '**',
    bulletListMarker: '-',
    // CommonMark's explicit hard break: visible, and editors don't strip it like trailing spaces.
    br: '\\',
  })
  turndown.keep(['small'])
  turndown.addRule('author-note', {
    filter: (node) => node.nodeName === 'ASIDE',
    replacement: (content, node) =>
      `\n\n<aside class="${(node as HTMLElement).getAttribute('class')}">\n\n${content.trim()}\n\n</aside>\n\n`,
  })
  return turndown
}

function toMarkdown(turndown: TurndownService, html: string) {
  return (
    turndown
      .turndown(html.replaceAll('<!--more-->', ''))
      // Only ever used as a plain space between words.
      .replace(/ /g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n'
  )
}

/** The teaser before <!--more-->, else the first paragraph, as plain text. Poem lines join with " / ". */
function getExcerpt(html: string, isPoem: boolean) {
  const teaser = html.includes('<!--more-->') ? html.split('<!--more-->')[0] : (/<p>[\s\S]*?<\/p>/.exec(html)?.[0] ?? '')
  const { document } = parseHTML(`<!doctype html><html><body>${teaser}</body></html>`)
  const blocks = [...document.body.querySelectorAll('p, h2')].filter((block) => !block.closest('aside'))
  const lines = blocks.flatMap((block) =>
    block.innerHTML
      .split(/<br\s*\/?>/i)
      .map((line) => parseHTML(`<!doctype html><html><body>${line}</body></html>`).document.body.textContent ?? '')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean),
  )
  const text = lines.join(isPoem ? ' / ' : ' ').replace(/ /g, ' ')
  if (text.length <= EXCERPT_MAX) return text

  const window = text.slice(0, EXCERPT_MAX)
  const sentenceEnd = Math.max(...['. ', '! ', '? ', '." ', '!" ', '?" ', '.” '].map((end) => window.lastIndexOf(end) + end.length - 1))
  if (sentenceEnd > EXCERPT_MAX / 3) return window.slice(0, sentenceEnd).trim()
  return `${window.slice(0, window.lastIndexOf(' '))}…`
}

function titleCase(tag: string) {
  return tag.replace(/(^|\s)\p{Ll}/gu, (letter) => letter.toUpperCase())
}

function typeOf(item: WxrItem) {
  if (item.categories.includes('poem')) return 'poem'
  if (item.categories.includes('flash-fiction')) return 'flash'
  return 'story'
}

/** The post's local date and time with its UTC offset, as WordPress showed it. */
function localIsoDate(item: WxrItem) {
  const xmlLocal = item.localDate
  const local = new Date(`${xmlLocal.replace(' ', 'T')}Z`)
  const offsetMinutes = Math.round((local.getTime() - item.date.getTime()) / 60000)
  const sign = offsetMinutes < 0 ? '-' : '+'
  const abs = Math.abs(offsetMinutes)
  return `${xmlLocal.replace(' ', 'T')}${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

function yamlString(value: string) {
  return JSON.stringify(value)
}

function frontmatter(fields: Record<string, string | boolean | string[] | undefined>) {
  const lines = ['---']
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      lines.push(value.length ? `${key}:` : `${key}: []`, ...value.map((entry) => `  - ${yamlString(entry)}`))
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`)
    } else {
      lines.push(`${key}: ${key === 'date' || key === 'type' || key === 'slug' ? value : yamlString(value)}`)
    }
  }
  lines.push('---', '')
  return lines.join('\n')
}

const exportPath = process.argv[2]
if (!exportPath) throw new Error('Usage: npm run import -- <export.xml>')

const turndown = createTurndown()
const items = readWxr(exportPath)
const urls: { id: string; type: string; status: string; slug: string; link: string; date: string; categories: string[]; tags: string[]; tagSlugs: string[] }[] = []
mkdirSync(PIECES_DIR, { recursive: true })
mkdirSync(PAGES_DIR, { recursive: true })

for (const item of items) {
  if (item.type !== 'post' && item.type !== 'page') continue
  urls.push({ id: item.id, type: item.type, status: item.status, slug: item.slug, link: item.link, date: item.localDate, categories: item.categories, tags: item.tags, tagSlugs: item.tagSlugs })

  if (item.type === 'page' && item.slug !== 'about-me') {
    report.skipped.push({ slug: item.slug, title: item.title, reason: 'page replaced by a link to https://moriel.tech/contact' })
    continue
  }

  const html = cleanHtml(item.slug, wpautop(item.content))
  const body = toMarkdown(turndown, html)

  if (item.type === 'page') {
    const description = getExcerpt(html, false).split(/(?<=\.)\s/)[0]
    writeFileSync(
      new URL('about.md', PAGES_DIR),
      frontmatter({ title: 'About', description, unlisted: true, note: 'Draft: this page is being rewritten.' }) + body,
    )
    continue
  }

  let title = item.title
  let note: string | undefined
  for (const [pattern, text] of TITLE_NOTES) {
    if (pattern.test(title)) {
      title = title.replace(pattern, '')
      note = text
    }
  }

  const type = typeOf(item)
  // Not written at all: the repo is public, so even a `draft: true` file would be readable on GitHub.
  if (item.status !== 'publish') {
    report.skipped.push({ slug: item.slug, title, reason: `WordPress ${item.status}; not imported (text stays in the export)` })
    continue
  }

  const fileName = `${item.localDate.slice(0, 10)}-${item.slug}.md`
  writeFileSync(
    new URL(fileName, PIECES_DIR),
    frontmatter({
      title,
      date: localIsoDate(item),
      slug: item.slug,
      type,
      tags: item.tags.map(titleCase),
      excerpt: getExcerpt(html, type === 'poem'),
      note,
    }) + body,
  )
}

const outDir = new URL('./', import.meta.url)
writeFileSync(new URL('report.json', outDir), JSON.stringify(report, null, 2) + '\n')
writeFileSync(new URL('urls.json', outDir), JSON.stringify(urls, null, 2) + '\n')
console.log(
  `Converted ${urls.filter((u) => u.type === 'post' && u.status === 'publish').length} published posts and the About page. ` +
    `${report.images.length} images removed, ${report.skipped.length} skipped. See tools/wp-import/report.json.`,
)
