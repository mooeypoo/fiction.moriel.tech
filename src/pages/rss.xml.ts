import type { APIRoute } from 'astro'
import { getListedPieces } from '../lib/content'
import { buildFeed } from '../lib/rss'
import { SITE_DESCRIPTION, SITE_TITLE } from '../lib/site'

export const GET: APIRoute = async () =>
  buildFeed({ title: SITE_TITLE, description: SITE_DESCRIPTION, path: '/', feedPath: '/rss.xml', pieces: await getListedPieces() })
