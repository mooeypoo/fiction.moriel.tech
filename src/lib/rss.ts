import type { Piece } from './content'
import { getPiecePath, getTypeInfo } from './pieces.ts'
import { SITE_URL } from './site.ts'

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

interface Feed {
  title: string
  description: string
  /** Site path of the page the feed describes, e.g. "/" or "/poems". */
  path: string
  /** Site path of the feed itself. */
  feedPath: string
  /** Listed pieces only; see lib/content. */
  pieces: Piece[]
}

export function buildFeed({ title, description, path, feedPath, pieces }: Feed) {
  const items = pieces
    .map((piece) => {
      const url = `${SITE_URL}${getPiecePath(piece.id)}`
      const categories = [getTypeInfo(piece.data.type).label, ...piece.data.tags].map((category) => `<category>${escapeXml(category)}</category>`)
      return [
        '<item>',
        `<title>${escapeXml(piece.data.title)}</title>`,
        `<description>${escapeXml(piece.data.excerpt)}</description>`,
        `<link>${url}</link>`,
        `<guid>${url}</guid>`,
        `<pubDate>${piece.data.date.toUTCString()}</pubDate>`,
        ...categories,
        '</item>',
      ].join('\n')
    })
    .join('\n')

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <description>${escapeXml(description)}</description>
    <link>${SITE_URL}${path === '/' ? '' : path}</link>
    <atom:link href="${SITE_URL}${feedPath}" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${(pieces[0]?.data.date ?? new Date()).toUTCString()}</lastBuildDate>
    <language>en-us</language>
    ${items}
  </channel>
</rss>`

  return new Response(rss, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } })
}
