// The built pieces keep what Markdown can silently lose, and the audio generator can read them.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getSpokenBlocks } from '../../src/lib/listen-text.ts'
import { contentFiles, htmlPages } from './helpers.ts'

const pages = htmlPages()
const pieces = contentFiles()
  .filter((file) => file.collection === 'pieces' && !file.draft)
  .map((file) => ({ file, document: pages.find((page) => page.path === file.path)?.document }))

test('every line break written in Markdown is a line break on the page', () => {
  for (const { file, document } of pieces) {
    const written = (file.body.match(/\\\n/g) ?? []).length
    const built = document!.querySelectorAll('.piece-content br').length
    assert.equal(built, written, file.file)
  }
})

test('poems keep every stanza', () => {
  for (const { file, document } of pieces.filter(({ file }) => file.type === 'poem')) {
    // Stanzas are the blank-line-separated blocks before the closing scene break and notes.
    const stanzas = file.body.split(/^\* \* \*$/m)[0].trim().split(/\n\s*\n/).length
    const content = document!.querySelector('.piece-content')!
    const paragraphs = [...content.children]
    const end = paragraphs.findIndex((el) => el.tagName === 'HR')
    assert.equal((end === -1 ? paragraphs : paragraphs.slice(0, end)).filter((el) => el.tagName === 'P').length, stanzas, file.file)
  }
})

// The audio generator reads built pages with these selectors; if they drift, audio silently stops.
test('every piece with a Listen player has text to read, title first', () => {
  for (const { file, document } of pieces) {
    if (!document!.querySelector('[data-listen]')) continue
    const blocks = getSpokenBlocks(document!)
    assert.ok(blocks.length > 1, file.file)
    assert.equal(blocks[0].element.tagName, 'H1', file.file)
  }
})
