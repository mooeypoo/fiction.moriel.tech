import { existsSync } from 'node:fs'
import { glob } from 'astro/loaders'
import { defineCollection } from 'astro:content'
import { z } from 'astro/zod'

const DATE_PREFIX = /^\d{4}-\d{2}(-\d{2})?-/
const pieceIdSources = new Map<string, string>()

// Filenames carry a date for sorting in the editor; URLs don't.
function generatePieceId({ entry, base, data }: { entry: string; base: URL; data: Record<string, unknown> }) {
  const fileName = entry.replace(/\.md$/i, '')
  const id = typeof data.slug === 'string' ? data.slug : fileName.replace(DATE_PREFIX, '')

  // Astro only warns on duplicate ids and silently keeps one entry. The existence
  // check avoids false positives in dev after a file is renamed.
  const previousEntry = pieceIdSources.get(id)
  if (previousEntry && previousEntry !== entry && existsSync(new URL(previousEntry, base))) {
    throw new Error(`Duplicate slug "${id}" from "${previousEntry}" and "${entry}". Rename one or set \`slug\` in its frontmatter.`)
  }
  pieceIdSources.set(id, entry)

  return id
}

export const PIECE_TYPES = ['story', 'flash', 'poem'] as const
export type PieceType = (typeof PIECE_TYPES)[number]

// Shared by pieces and pages (docs/FRONTMATTER.md).
const visibility = {
  // Not built in production at all; visible in `astro dev`.
  draft: z.boolean().default(false),
  // Built at its URL but left out of every listing, feed, and the sitemap, and marked noindex.
  unlisted: z.boolean().default(false),
  // A short line shown above the text, e.g. "Working draft".
  note: z.string().optional(),
}

const pieces = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pieces', generateId: generatePieceId }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    // Overrides the filename-derived URL slug.
    slug: z.string().optional(),
    type: z.enum(PIECE_TYPES),
    tags: z.array(z.string()).default([]),
    // Cards, listings, social previews, RSS.
    excerpt: z.string(),
    // false removes the Listen player and skips audio generation (docs/AUDIO.md).
    listen: z.boolean().default(true),
    ...visibility,
  }),
})

// Standalone pages (About), served at /<id>.
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    ...visibility,
  }),
})

export const collections = {
  pieces,
  pages,
}
