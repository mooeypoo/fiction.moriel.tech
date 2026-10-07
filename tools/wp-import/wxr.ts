// Reads the parts of a WordPress export (WXR) the migration uses.
import { readFileSync } from 'node:fs'
import { DOMParser } from 'linkedom'

export interface WxrItem {
  id: string
  type: string
  status: string
  slug: string
  title: string
  link: string
  /** UTC, from post_date_gmt. Drafts have none, so they fall back to the local date. */
  date: Date
  /** As written in WordPress, in the site's timezone: "2015-10-25 14:29:40". */
  localDate: string
  content: string
  categories: string[]
  /** Display names. */
  tags: string[]
  /** WordPress's URL slugs for the tags, in the same order. */
  tagSlugs: string[]
}

export function readWxr(path: string) {
  const xml = new DOMParser().parseFromString(readFileSync(path, 'utf8'), 'text/xml')
  const text = (parent: Element, tag: string) => parent.getElementsByTagName(tag)[0]?.textContent ?? ''

  return [...xml.getElementsByTagName('item')].map((item): WxrItem => {
    const terms = (domain: string) =>
      [...item.getElementsByTagName('category')].filter((term) => term.getAttribute('domain') === domain)
    const gmt = text(item, 'wp:post_date_gmt')
    const date = gmt && !gmt.startsWith('0000') ? `${gmt.replace(' ', 'T')}Z` : text(item, 'wp:post_date').replace(' ', 'T')

    return {
      id: text(item, 'wp:post_id'),
      type: text(item, 'wp:post_type'),
      status: text(item, 'wp:status'),
      slug: text(item, 'wp:post_name'),
      title: text(item, 'title'),
      link: text(item, 'link'),
      date: new Date(date),
      localDate: text(item, 'wp:post_date'),
      content: text(item, 'content:encoded'),
      categories: terms('category').map((term) => term.getAttribute('nicename') ?? ''),
      tags: terms('post_tag').map((term) => term.textContent ?? ''),
      tagSlugs: terms('post_tag').map((term) => term.getAttribute('nicename') ?? ''),
    }
  })
}
