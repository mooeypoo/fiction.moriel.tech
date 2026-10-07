// @ts-check
import { readdirSync, readFileSync } from 'node:fs'
import { defineConfig, fontProviders } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import vue from '@astrojs/vue'
import { satteri } from '@astrojs/markdown-satteri'
import { openExternalLinksInNewTab, wrapLines } from './src/lib/markdown-plugins.mjs'
import { themeInitHash } from './src/lib/theme-init.mjs'

const SITE = 'https://fiction.moriel.tech'
const AUDIO = 'https://mooeypoo.github.io/fiction.moriel.tech/'

/**
 * Unlisted pieces and pages (docs/FRONTMATTER.md) stay out of the sitemap. The sitemap filter
 * runs outside Astro's content layer, so it reads the frontmatter flag itself.
 * @param {string} dir
 * @param {(file: string, source: string) => string} toPath
 */
function unlistedPaths(dir, toPath) {
  return readdirSync(new URL(dir, import.meta.url))
    .filter((file) => file.endsWith('.md'))
    .map((file) => ({ file, source: readFileSync(new URL(`${dir}/${file}`, import.meta.url), 'utf8') }))
    .filter(({ source }) => /^unlisted:\s*true\s*$/m.test(source.split(/^---$/m)[1] ?? ''))
    .map(({ file, source }) => `${SITE}${toPath(file, source)}`)
}

const unlisted = new Set([
  ...unlistedPaths('./src/content/pieces', (file, source) => {
    const slug = /^slug:\s*(\S+)\s*$/m.exec(source)?.[1] ?? file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}(-\d{2})?-/, '')
    return `/pieces/${slug}/`
  }),
  ...unlistedPaths('./src/content/pages', (file) => `/${file.replace(/\.md$/, '')}/`),
])

// https://astro.build/config
export default defineConfig({
  site: SITE,
  output: 'static',
  compressHTML: true,
  // The CSS is small; inlining it saves a render-blocking request. Astro hashes it into the CSP.
  build: { inlineStylesheets: 'always' },
  security: {
    // Astro hashes its own inline scripts and styles into a per-page <meta> CSP. Anything
    // third-party must be listed here, or it's silently blocked in production.
    csp: {
      directives: [
        "default-src 'self'",
        // data: is the external-link icon (an inline SVG mask).
        "img-src 'self' data:",
        "font-src 'self'",
        // The Listen player fetches its manifest and audio from this repo's GitHub Pages (docs/AUDIO.md).
        `connect-src 'self' https://plausible.io ${AUDIO}`,
        `media-src 'self' ${AUDIO}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: {
        resources: ["'self'", 'https://plausible.io'],
        // Astro doesn't hash is:inline scripts.
        hashes: [themeInitHash],
      },
    },
  },
  // Downloaded at build time and served from this site: no third-party requests, and
  // generated fallback metrics keep text from shifting while fonts load.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Literata',
      cssVariable: '--font-literata',
      weights: [400, 600],
      styles: ['normal', 'italic'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['Georgia', 'serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'Fraunces',
      cssVariable: '--font-fraunces',
      weights: [400, 600],
      styles: ['normal', 'italic'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['Georgia', 'serif'],
    },
  ],
  markdown: {
    // No code on this site; Shiki's inline styles would also need a CSP exception.
    syntaxHighlight: false,
    processor: satteri({
      // Parse raw HTML in pieces (the author's-note <aside>) into elements so plugins see it too.
      features: { rawHtml: true },
      hastPlugins: [wrapLines, openExternalLinksInNewTab(SITE)],
    }),
  },
  integrations: [sitemap({ filter: (page) => !unlisted.has(page) && !page.endsWith('/404/') }), vue()],
})
