// Pure helpers for pieces: no astro:content, so tests and the audio tool can import them.

export const PIECE_TYPES = ['story', 'flash', 'poem'] as const
export type PieceType = (typeof PIECE_TYPES)[number]

export interface TypeInfo {
  type: PieceType
  /** "Story", for a single piece. */
  label: string
  /** "Stories", for headings. */
  plural: string
  /** The header nav's shorter name. */
  nav: string
  path: `/${string}`
  description: string
}

export const TYPES: TypeInfo[] = [
  { type: 'story', label: 'Story', plural: 'Stories', nav: 'Stories', path: '/stories', description: 'Short stories, and the occasional longer one.' },
  { type: 'flash', label: 'Flash', plural: 'Flash fiction', nav: 'Flash', path: '/flash', description: 'Very short fiction: a scene, a moment, a twist.' },
  { type: 'poem', label: 'Poem', plural: 'Poems', nav: 'Poems', path: '/poems', description: 'The occasional poem.' },
]

export function getTypeInfo(type: PieceType) {
  return TYPES.find((info) => info.type === type)!
}

export const getPiecePath = (slug: string) => `/pieces/${slug}`

/**
 * URL-safe tag names. Matches WordPress's tag slugs ("Critical Thinking" → critical-thinking),
 * which keeps the old /tag/ URLs redirectable.
 */
export function getTagSlug(tag: string) {
  return tag
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export const getTagPath = (tag: string) => `/tags/${getTagSlug(tag)}`

/** Words a reader reads: Markdown syntax, link targets, and HTML tags aren't counted. */
export function getWordCount(markdown: string) {
  const prose = markdown.replace(/\]\([^)]*\)/g, ']').replace(/<[^>]+>/g, ' ')
  return prose.split(/\s+/).filter((word) => /\w/.test(word)).length
}

// Brysbaert (2019): adults read fiction silently at ~260 wpm.
const WORDS_PER_MINUTE = 250

export function getReadingMinutes(markdown: string) {
  return Math.max(1, Math.round(getWordCount(markdown) / WORDS_PER_MINUTE))
}

/** Lines of the poem itself: up to its first scene break, after which come notes about it. */
export function getPoemLineCount(markdown: string) {
  const poem = markdown.split(/^\* \* \*$/m)[0]
  return poem.split('\n').filter((line) => line.trim()).length
}

// Dates without a time are UTC midnight; formatting in UTC keeps them on their day.
export function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

export function getYear(date: Date) {
  return date.getUTCFullYear()
}
