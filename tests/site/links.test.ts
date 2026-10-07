// No broken internal links, images, scripts, or styles anywhere on the built site.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { htmlPages, resolves } from './helpers.ts'

const SITE = 'https://fiction.moriel.tech'

test('every internal link and asset resolves to a built file', () => {
  const broken: string[] = []
  for (const { path, document } of htmlPages()) {
    const references = [
      ...[...document.querySelectorAll('a[href], link[href]')].map((el) => el.getAttribute('href')!),
      ...[...document.querySelectorAll('img[src], script[src]')].map((el) => el.getAttribute('src')!),
      ...[...document.querySelectorAll('meta[property="og:image"], meta[property="og:url"]')].map((el) => el.getAttribute('content')!),
    ]
    for (const reference of references) {
      const url = new URL(reference, `${SITE}${path}`)
      if (url.origin !== SITE || (url.pathname === new URL(path, SITE).pathname && url.hash)) continue
      if (!resolves(url.pathname)) broken.push(`${path} → ${reference}`)
    }
  }
  assert.deepEqual(broken, [])
})
