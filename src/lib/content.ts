import { getCollection, type CollectionEntry } from 'astro:content'
import type { PieceType } from './pieces.ts'
import { isBuilt, isListed } from './visibility.ts'

export type Piece = CollectionEntry<'pieces'>

const newestFirst = (a: Piece, b: Piece) => b.data.date.getTime() - a.data.date.getTime()

/** Every piece that gets a page, unlisted ones included. */
export async function getBuiltPieces() {
  return (await getCollection('pieces', ({ data }) => isBuilt(data, import.meta.env.DEV))).sort(newestFirst)
}

/** Pieces for listings, feeds, and prev/next, newest first. */
export async function getListedPieces(type?: PieceType) {
  const pieces = await getCollection('pieces', ({ data }) => isListed(data, import.meta.env.DEV) && (!type || data.type === type))
  return pieces.sort(newestFirst)
}

export async function getBuiltPages() {
  return getCollection('pages', ({ data }) => isBuilt(data, import.meta.env.DEV))
}

export function getTags(pieces: Piece[]) {
  const counts = new Map<string, number>()
  for (const piece of pieces) for (const tag of piece.data.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([tag, count]) => ({ tag, count }))
}

/** Groups newest first, by year, for the archive. */
export function groupByYear(pieces: Piece[]) {
  const years = new Map<number, Piece[]>()
  for (const piece of pieces) {
    const year = piece.data.date.getUTCFullYear()
    years.set(year, [...(years.get(year) ?? []), piece])
  }
  return [...years].sort(([a], [b]) => b - a)
}
