import type { APIRoute, GetStaticPaths } from 'astro'
import { getBuiltPieces, getListedPieces, getTags } from '../../lib/content'
import { getTagSlug, getTypeInfo, TYPES } from '../../lib/pieces'
import { SITE_SUBTITLE, SITE_TITLE } from '../../lib/site'
import { renderCard, type SocialCard } from '../../lib/social-cards'

export const getStaticPaths = (async () => {
  const listed = await getListedPieces()
  const cards: SocialCard[] = [
    { path: 'home', title: SITE_TITLE, text: SITE_SUBTITLE },
    { path: 'archive', title: 'Archive', text: `All ${listed.length} pieces, by year.` },
    { path: 'tags', title: 'Tags', text: 'Themes across stories, flash fiction, and poems.' },
    ...TYPES.map((info) => ({ path: info.path.slice(1), title: info.plural, text: info.description })),
    ...getTags(listed).map(({ tag, count }) => ({ path: `tags/${getTagSlug(tag)}`, eyebrow: 'Tagged', title: tag, text: `${count} ${count === 1 ? 'piece' : 'pieces'}` })),
  ]
  for (const piece of await getBuiltPieces()) {
    cards.push({ path: `pieces/${piece.id}`, eyebrow: getTypeInfo(piece.data.type).label, title: piece.data.title, text: piece.data.excerpt })
  }
  return cards.map((card) => ({ params: { card: card.path }, props: { card } }))
}) satisfies GetStaticPaths

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await renderCard(props.card as SocialCard)), { headers: { 'content-type': 'image/jpeg' } })
