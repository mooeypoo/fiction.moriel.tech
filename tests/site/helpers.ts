// Reads the built site (dist/) and the content files, for tests that check the build output.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseHTML } from 'linkedom'

export const DIST = new URL('../../dist/', import.meta.url).pathname
const CONTENT = new URL('../../src/content/', import.meta.url).pathname

if (!existsSync(join(DIST, 'index.html'))) throw new Error('No build in dist/: run `npm run build` first.')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

/** Every built HTML page: its URL path and document. */
export function htmlPages() {
  return walk(DIST)
    .filter((file) => file.endsWith('.html'))
    .map((file) => {
      const path = `/${relative(DIST, file)}`.replace(/index\.html$/, '').replace(/\.html$/, '')
      return { path, file, document: parseHTML(readFileSync(file, 'utf8')).document }
    })
}

export function readDist(path: string) {
  return readFileSync(join(DIST, path), 'utf8')
}

/** Does a site path resolve to a built file, the way Netlify serves them? */
export function resolves(path: string) {
  const clean = decodeURIComponent(path.split(/[?#]/)[0])
  const candidates = clean.endsWith('/') ? [join(clean, 'index.html')] : [clean, `${clean}.html`, join(clean, 'index.html')]
  return candidates.some((candidate) => existsSync(join(DIST, candidate)) && statSync(join(DIST, candidate)).isFile())
}

export interface ContentFile {
  collection: 'pieces' | 'pages'
  file: string
  body: string
  slug: string
  path: string
  type?: string
  draft: boolean
  unlisted: boolean
}

/** Content files with the frontmatter fields the tests need. */
export function contentFiles(): ContentFile[] {
  return (['pieces', 'pages'] as const).flatMap((collection) =>
    readdirSync(join(CONTENT, collection))
      .filter((file) => file.endsWith('.md'))
      .map((file) => {
        const [, frontmatter = '', ...rest] = readFileSync(join(CONTENT, collection, file), 'utf8').split(/^---$/m)
        const field = (name: string) => new RegExp(`^${name}:\\s*(.+?)\\s*$`, 'm').exec(frontmatter)?.[1]
        const slug = field('slug') ?? file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}(-\d{2})?-/, '')
        return {
          collection,
          file,
          body: rest.join('---'),
          slug,
          path: collection === 'pieces' ? `/pieces/${slug}/` : `/${slug}/`,
          type: field('type'),
          draft: field('draft') === 'true',
          unlisted: field('unlisted') === 'true',
        }
      }),
  )
}
