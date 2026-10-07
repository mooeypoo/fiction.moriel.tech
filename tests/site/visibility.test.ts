// Drafts aren't built; unlisted pages are built but hidden from listings, feeds, the sitemap,
// and search engines (docs/FRONTMATTER.md).
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { test } from 'node:test'
import { contentFiles, DIST, htmlPages, readDist, resolves } from './helpers.ts'

const files = contentFiles()
const pages = htmlPages()
const feeds = ['rss.xml', ...['stories', 'flash', 'poems'].map((type) => `${type}/rss.xml`)].map(readDist)
const sitemap = readdirSync(DIST).filter((file) => file.startsWith('sitemap-') && file !== 'sitemap-index.xml').map(readDist).join('\n')

test('drafts are not built', () => {
  for (const file of files.filter((file) => file.draft)) assert.equal(resolves(file.path), false, file.file)
})

test('published pieces are listed in the sitemap and feeds, and indexable', () => {
  for (const file of files.filter((file) => file.collection === 'pieces' && !file.draft && !file.unlisted)) {
    assert.ok(sitemap.includes(`https://fiction.moriel.tech${file.path}`), `${file.file} missing from the sitemap`)
    assert.ok(feeds[0].includes(`/pieces/${file.slug}<`), `${file.file} missing from rss.xml`)
    const page = pages.find((page) => page.path === file.path)
    assert.equal(page?.document.querySelector('meta[name="robots"]'), null, `${file.file} is noindex`)
  }
})

test('unlisted pages are built, noindex, and never listed or linked', () => {
  for (const file of files.filter((file) => file.unlisted && !file.draft)) {
    const page = pages.find((page) => page.path === file.path)
    assert.ok(page, `${file.file} isn't built`)
    assert.equal(page.document.querySelector('meta[name="robots"]')?.getAttribute('content'), 'noindex', file.file)
    assert.ok(!sitemap.includes(file.path), `${file.file} is in the sitemap`)
    for (const feed of feeds) assert.ok(!feed.includes(`${file.path.replace(/\/$/, '')}<`), `${file.file} is in a feed`)
    const linkedFrom = pages
      .filter((other) => other.path !== file.path)
      .filter((other) => [...other.document.querySelectorAll('a[href]')].some((a) => a.getAttribute('href')!.replace(/\/$/, '') === file.path.replace(/\/$/, '')))
      .map((other) => other.path)
    assert.deepEqual(linkedFrom, [], `${file.file} is linked from other pages`)
  }
})
