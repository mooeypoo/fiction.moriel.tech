# Frontmatter reference

Every field a piece or page can use. The schema lives in [`src/content.config.ts`](../src/content.config.ts); the build fails on an unknown `type` or a duplicate slug. Keep this file in sync when a field is added.

## Pieces (`src/content/pieces/*.md`)

```yaml
---
title: "God Says No"                    # required
date: 2011-02-27T02:21:19-04:00         # required; a plain date (2026-10-07) works too
type: poem                              # required: story | flash | poem
excerpt: "No no no, / Please, continue" # required; cards, social previews, RSS
tags:
  - "Religion"
slug: god-says-no
note: "Working draft"
listen: true
draft: false
unlisted: false
---
```

### Required

| Field | What it does |
|---|---|
| `title` | Piece title. |
| `date` | Publication date; sorts every listing and the RSS feed. |
| `type` | `story`, `flash`, or `poem`. Picks the listing page (`/stories`, `/flash`, `/poems`) and, for poems, the poem layout. |
| `excerpt` | Summary for cards, social previews, search results, and RSS. For poems, the opening lines joined with ` / `. |

### Optional

| Field | Default | What it does |
|---|---|---|
| `tags` | `[]` | Themes across types; each gets a tag page. |
| `slug` | from filename | The URL: `/pieces/<slug>`. Filenames start with a date (`2011-02-27-god-says-no.md`) that's dropped from the URL. Never change a published slug without a redirect. |
| `note` | none | A short line shown above the text, e.g. `Working draft`. |
| `listen` | `true` | `false` removes the Listen player and skips audio generation. |
| `draft` | `false` | `true` keeps the piece out of the production build entirely. It still shows in `npm run dev`. The repo is public, so a committed draft can still be read on GitHub; keep work you don't want seen on a local branch. |
| `unlisted` | `false` | `true` builds the piece at its URL but leaves it out of every listing, RSS, the sitemap, and prev/next links, and asks search engines not to index it. Anyone with the link can read it. |

### In the body

- **Line breaks:** end a line with a backslash (`\`) to keep the next line on its own line. Poems use this for every line; a blank line starts a new stanza or paragraph. A plain newline without the backslash joins the lines.
- **Scene breaks:** `* * *` on its own line.

## Pages (`src/content/pages/*.md`)

Served at `/<filename>`: `about.md` → `/about`.

| Field | Required | What it does |
|---|---|---|
| `title` | yes | Page title. |
| `description` | yes | Meta description and social previews. |
| `note`, `draft`, `unlisted` | no | As for pieces. |
