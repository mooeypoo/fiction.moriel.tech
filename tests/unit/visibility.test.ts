// Drafts must never reach production, and unlisted pages must stay out of listings.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isBuilt, isIndexable, isListed } from '../../src/lib/visibility.ts'

const published = {}
const draft = { draft: true }
const unlisted = { unlisted: true }

test('production builds published and unlisted pieces, never drafts', () => {
  assert.equal(isBuilt(published, false), true)
  assert.equal(isBuilt(unlisted, false), true)
  assert.equal(isBuilt(draft, false), false)
})

test('the dev server shows drafts', () => {
  assert.equal(isBuilt(draft, true), true)
})

test('only published pieces are listed', () => {
  assert.equal(isListed(published, false), true)
  assert.equal(isListed(unlisted, false), false)
  assert.equal(isListed(draft, false), false)
  assert.equal(isListed(unlisted, true), false)
})

test('search engines may index only published pieces', () => {
  assert.equal(isIndexable(published), true)
  assert.equal(isIndexable(unlisted), false)
  assert.equal(isIndexable(draft), false)
})
