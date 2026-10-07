// Every old lit.smarterthanthat.com URL reaches a page that exists here (public/_redirects).
// Netlify's matching is simulated: first rule wins, trailing slashes don't matter, `/*` matches
// the path and anything under it, and `name=:value` matches a query parameter by name.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { readDist, resolves } from './helpers.ts'

const OLD = 'https://lit.smarterthanthat.com'
const NEW = 'https://fiction.moriel.tech'

interface Rule {
  origin?: string
  path: string
  query: [string, string][]
  to: string
  status: string
}

const rules: Rule[] = readDist('_redirects')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const [from, ...rest] = line.split(/\s+/)
    const status = rest.pop()!
    const to = rest.pop()!
    const url = /^https?:\/\//.test(from) ? new URL(from) : undefined
    const query = rest.map((part) => part.split('=') as [string, string])
    return { origin: url?.origin, path: url ? decodeURI(url.pathname) : from, query, to, status }
  })

const trim = (path: string) => path.replace(/\/+$/, '') || '/'

function match(url: URL) {
  const path = trim(url.pathname)
  for (const rule of rules) {
    if (rule.origin && rule.origin !== url.origin) continue
    if (!rule.origin && url.origin !== NEW && url.origin !== OLD.replace('https:', 'http:') && url.origin !== OLD) continue
    let splat = ''
    if (rule.path.endsWith('/*')) {
      const base = trim(rule.path.slice(0, -2))
      if (base === '/') splat = path.slice(1)
      else if (path === base) splat = ''
      else if (path.startsWith(`${base}/`)) splat = path.slice(base.length + 1)
      else continue
    } else if (trim(rule.path) !== path) continue
    const values: Record<string, string> = {}
    if (!rule.query.every(([name, placeholder]) => url.searchParams.has(name) && (values[placeholder] = url.searchParams.get(name)!))) continue
    let to = rule.to.replace(':splat', splat)
    for (const [placeholder, value] of Object.entries(values)) to = to.replace(placeholder, value)
    return { to: new URL(to, url.origin), status: rule.status }
  }
  return undefined
}

/** Follows redirects the way a browser would; returns the final URL and the hops taken. */
function follow(start: string) {
  let url = new URL(start)
  const hops: string[] = []
  for (let i = 0; i < 5; i++) {
    const next = match(url)
    if (!next) break
    assert.equal(next.status, '301!', `${url} redirects with ${next.status}`)
    hops.push(next.to.href)
    url = next.to
  }
  return { url, hops }
}

const reachesPage = (url: URL) => url.origin === NEW && resolves(url.pathname)

// The old URLs, from the WordPress export: what readers, search engines, and feed readers have.
const items: { id: string; type: string; status: string; slug: string; link: string; date: string; categories: string[]; tagSlugs: string[] }[] =
  JSON.parse(readFileSync(new URL('../../tools/wp-import/urls.json', import.meta.url), 'utf8'))
const published = items.filter((item) => item.status === 'publish')
const posts = published.filter((item) => item.type === 'post')

const oldUrls = [
  `${OLD}/`,
  `${OLD}/page/2/`,
  `${OLD}/feed/`,
  `${OLD}/feed/atom/`,
  `${OLD}/comments/feed/`,
  `${OLD}/?feed=rss2`,
  `${OLD}/author/mooeypoo/`,
  ...posts.flatMap((post) => [
    post.link,
    `${post.link}feed/`,
    `${OLD}/${post.slug}/`,
    `${OLD}/?p=${post.id}`,
    ...post.categories.map((category) => `${OLD}/${category}/${post.slug}/`),
    `${OLD}/${post.date.slice(0, 4)}/`,
    `${OLD}/${post.date.slice(0, 4)}/${post.date.slice(5, 7)}/`,
  ]),
  ...published.filter((item) => item.type === 'page').flatMap((page) => [page.link, `${OLD}/?page_id=${page.id}`]),
  ...[...new Set(posts.flatMap((post) => post.categories))].flatMap((category) => [
    `${OLD}/category/${category}/`,
    `${OLD}/category/${category}/page/2/`,
    `${OLD}/category/${category}/feed/`,
  ]),
  ...[...new Set(posts.flatMap((post) => post.tagSlugs))].flatMap((tag) => [`${OLD}/tag/${tag}/`, `${OLD}/tag/${tag}/feed/`]),
]

test('every old URL ends on a page that exists, in one redirect', () => {
  const failures: string[] = []
  for (const old of [...new Set(oldUrls)]) {
    for (const start of [old, old.replace('https:', 'http:')]) {
      const { url, hops } = follow(start)
      const ok = url.href === 'https://moriel.tech/contact' || reachesPage(url)
      // ?p= links take two hops by design (through /p/<id>); everything else takes one.
      const maxHops = new URL(start).search.match(/[?&](p|page_id)=/) ? 2 : 1
      if (!ok || hops.length > maxHops) failures.push(`${start} → ${hops.join(' → ') || '(no redirect)'}`)
    }
  }
  assert.deepEqual(failures, [])
})

test('old URLs land where a reader expects', () => {
  const expectations: [string, string][] = [
    [`${OLD}/prose/the-box/`, `${NEW}/pieces/the-box/`],
    [`${OLD}/flash-fiction/the-box/`, `${NEW}/pieces/the-box/`],
    [`${OLD}/poem/god-says-no/feed/`, `${NEW}/pieces/god-says-no/`],
    [`${OLD}/category/poem/`, `${NEW}/poems/`],
    [`${OLD}/category/flash-fiction/feed/`, `${NEW}/flash/rss.xml`],
    [`${OLD}/category/prose/`, `${NEW}/archive/`],
    [`${OLD}/tag/critical-thinking/`, `${NEW}/tags/critical-thinking/`],
    [`${OLD}/feed/`, `${NEW}/rss.xml`],
    [`${OLD}/2011/04/`, `${NEW}/archive/#year-2011`],
    [`${OLD}/about-me/`, `${NEW}/about/`],
    [`${OLD}/contact/`, 'https://moriel.tech/contact'],
    [`${OLD}/?p=17`, `${NEW}/pieces/one-million/`],
    [`${OLD}/`, `${NEW}/`],
  ]
  for (const [from, to] of expectations) assert.equal(follow(from).url.href, to, from)
})

test("old image URLs end on the 404 page (images weren't migrated)", () => {
  const { url } = follow(`${OLD}/wp-content/uploads/2011/05/mewhiteshirt.jpg`)
  assert.equal(url.origin, NEW)
  assert.equal(reachesPage(url), false)
})

test('every redirect target on this site exists', () => {
  const missing = rules
    .filter((rule) => !/:\w+/.test(rule.to))
    .map((rule) => new URL(rule.to, NEW))
    .filter((url) => url.origin === NEW && !resolves(url.pathname))
    .map((url) => url.href)
  assert.deepEqual(missing, [])
})
