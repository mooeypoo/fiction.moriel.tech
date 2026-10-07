// What the Listen player reads aloud. It's hashed to match published audio, so a change here
// should be deliberate (docs/AUDIO.md).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseHTML } from 'linkedom'
import { getSpokenBlocks } from '../../src/lib/listen-text.ts'

function spoken(content: string) {
  const { document } = parseHTML(
    `<!doctype html><html><body><header class="piece-header"><h1>Title</h1></header><div class="piece-content">${content}</div></body></html>`,
  )
  return getSpokenBlocks(document).map((block) => block.text)
}

test('reads the title first, then one block at a time', () => {
  assert.deepEqual(spoken('<p>One.</p><hr><p>Two.</p>'), ['Title', 'One.', 'Two.'])
})

test('pauses at the end of each poem line', () => {
  const stanza = '<p><span class="line">No no no,</span><br>\n<span class="line">Please, continue</span><br>\n<span class="line">Crushing curiosity</span></p>'
  assert.deepEqual(spoken(stanza).slice(1), ['No no no, Please, continue, Crushing curiosity'])
})

test("doesn't add a pause where a line already has one", () => {
  const stanza = '<p><span class="line">I start saying no.</span><br><span class="line">Why “now?”</span><br><span class="line">Because</span></p>'
  assert.deepEqual(spoken(stanza).slice(1), ['I start saying no. Why now? Because'])
})

test('skips screen-reader-only text', () => {
  assert.deepEqual(spoken('<p><a href="#">A link<span class="sr-only"> (opens in a new tab)</span></a>.</p>').slice(1), ['A link.'])
})
