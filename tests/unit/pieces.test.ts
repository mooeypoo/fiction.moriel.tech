import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPoemLineCount, getTagSlug } from '../../src/lib/pieces.ts'

// The old WordPress tag URLs redirect to these, so they must keep matching its slugs.
test('tag slugs match WordPress tag slugs', () => {
  assert.equal(getTagSlug('Critical Thinking'), 'critical-thinking')
  assert.equal(getTagSlug('Sarcasm'), 'sarcasm')
  assert.equal(getTagSlug('Café & Crème'), 'cafe-creme')
})

test("a poem's line count stops at the notes after its closing scene break", () => {
  const poem = 'One\\\nTwo\n\nThree\n\n* * *\n\n*Written as a response to…*\n'
  assert.equal(getPoemLineCount(poem), 3)
})
