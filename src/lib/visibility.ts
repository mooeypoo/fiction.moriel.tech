// Who gets to see a piece or page (docs/FRONTMATTER.md). Pure, so it's tested directly.

export interface Visibility {
  draft?: boolean
  unlisted?: boolean
}

/** Drafts are only built by the dev server. */
export function isBuilt(data: Visibility, isDev: boolean) {
  return isDev || data.draft !== true
}

/** Listings, feeds, the sitemap, and prev/next links. Unlisted pages are reachable only by URL. */
export function isListed(data: Visibility, isDev: boolean) {
  return isBuilt(data, isDev) && data.unlisted !== true
}

/** Unlisted pages ask search engines to stay away; so do drafts in dev, to be safe. */
export function isIndexable(data: Visibility) {
  return data.draft !== true && data.unlisted !== true
}
