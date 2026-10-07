export const SITE_URL = 'https://fiction.moriel.tech'
export const SITE_TITLE = 'Imaginary Parts'
export const SITE_SUBTITLE = 'Stories, flash fiction, and the occasional poem'
// Adapted from the old site's tagline; the home page epigraph.
export const SITE_EPIGRAPH = 'The literary musings of a creative physicist.'
export const SITE_DESCRIPTION = `${SITE_SUBTITLE}, by Moriel Schottlender.`
export const AUTHOR = 'Moriel Schottlender'
export const CONTACT_URL = 'https://moriel.tech/contact'

export const ELSEWHERE = [
  { label: 'moriel.tech', href: 'https://moriel.tech' },
  { label: 'Blog', href: 'https://blog.moriel.tech' },
  { label: 'YouTube', href: 'https://www.youtube.com/@MorielTech' },
  { label: 'Mastodon', href: 'https://notacult.social/@mooeypoo' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/moriel/' },
  { label: 'Twitter', href: 'https://twitter.com/mooeypoo' },
  { label: 'GitHub', href: 'https://github.com/mooeypoo' },
]

export function toAbsoluteUrl(path: string) {
  return /^https?:\/\//i.test(path) ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`
}
