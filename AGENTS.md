# AGENTS.md

Guidance for AI coding agents working in this repo (Claude Code reads it through `CLAUDE.md`).

fiction.moriel.tech ("Imaginary Parts") is Moriel Schottlender's fiction site: stories, flash fiction, and poems. A static Astro site on Netlify, written in Markdown, with a little plain TypeScript where it needs interaction (theme toggle, Listen player). Readability, performance, and minimal client-side JavaScript are the priorities. Its conventions follow [blog.moriel.tech](https://github.com/mooeypoo/blog.moriel.tech); its design doesn't.

## Read first

- [docs/FRONTMATTER.md](docs/FRONTMATTER.md): every field a piece or page can use. **Update it whenever a field is added or changed.**
- [docs/AUDIO.md](docs/AUDIO.md): how the Listen audio is generated and published.

## Commands

```bash
npm ci && npm test && npm run build && npm run test:site   # what CI and Netlify run
npm run dev                  # local dev server (shows drafts; the CSP isn't applied in dev)
npm run preview              # serve dist/ with the CSP, after a build
npm run audio -- <slug>      # generate a piece's audio locally (after npm run audio:install)
```

## Layout

- `src/content/pieces/*.md`: pieces (`type`: story, flash, poem). `src/content/pages/*.md`: standalone pages (About).
- `src/content.config.ts`: the schemas. `src/lib/`: shared logic. Pure modules (`pieces.ts`, `visibility.ts`, `listen-text.ts`, `speech.ts`) don't import `astro:*`, so tests and tools can use them.
- `src/lib/markdown-plugins.mjs`: wraps each line of a paragraph with line breaks in `<span class="line">` (poems' hanging indents), and marks external links.
- `tests/unit/`: fast tests of pure logic. `tests/site/`: checks on the built `dist/` (links, unlisted pages, line breaks, audio text).
- `tools/listen-audio/`: the audio generator, a separate package so Netlify never installs it.
- `public/_redirects`: Netlify redirects. The generated block maps every old lit.smarterthanthat.com URL (`tools/wp-import/redirects.ts`); add new redirects by hand above it. `tests/site/redirects.test.ts` checks every old URL reaches a page.
- `tools/wp-import/`: the one-off WordPress migration, kept for reference.

## Things that are easy to break

- **Poem line breaks.** A line ends with `\` in Markdown; without it the next line joins it. `tests/site/pieces.test.ts` checks every one survives.
- **The spoken text is hashed.** Changing `src/lib/listen-text.ts`, `normalizeForSpeech`, or the generator's voice settings invalidates every piece's audio. Only do it deliberately, and say so in the PR.
- **CSP.** `security.csp` in `astro.config.mjs` lists every allowed origin. A new third-party script, style, image, media, or fetch origin must be added there, or it's silently blocked. Test with `npm run build && npm run preview`.
- **URLs** are `/pieces/<slug>`. Never change a published slug without a redirect in `public/_redirects`.
- **Drafts in a public repo** are still readable on GitHub. `draft: true` only keeps them off the site.

## Conventions

- **Code comments:** concise, explaining *why*.
- **Tests:** only for logic that's easy to break or costly when it breaks; no tests that restate the code.
- **Commits:** logical steps, messages explaining the reason. Every commit should build on its own.
- **PRs:** one feature per PR. Moriel pushes and opens PRs; agents prepare the branch, commits, and a PR title and description, and don't push or merge.
- **Dependencies and CI:** no React anywhere. Actions pinned to commit SHAs, exact or locked versions, `npm audit` clean, least-privilege workflow permissions.
