// One feed per type: /stories/rss.xml, /flash/rss.xml, /poems/rss.xml.
import type { APIRoute, GetStaticPaths } from 'astro'
import { getListedPieces } from '../../lib/content'
import { TYPES, type TypeInfo } from '../../lib/pieces'
import { buildFeed } from '../../lib/rss'
import { SITE_TITLE } from '../../lib/site'

export const getStaticPaths = (() => TYPES.map((info) => ({ params: { type: info.path.slice(1) }, props: { info } }))) satisfies GetStaticPaths

export const GET: APIRoute = async ({ props }) => {
  const { info } = props as { info: TypeInfo }
  return buildFeed({
    title: `${info.plural} · ${SITE_TITLE}`,
    description: info.description,
    path: info.path,
    feedPath: `${info.path}/rss.xml`,
    pieces: await getListedPieces(info.type),
  })
}
