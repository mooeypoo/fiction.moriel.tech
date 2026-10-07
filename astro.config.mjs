// @ts-check
import { defineConfig } from 'astro/config'
import vue from '@astrojs/vue'
import { satteri } from '@astrojs/markdown-satteri'

const SITE = 'https://fiction.moriel.tech'

// https://astro.build/config
export default defineConfig({
  site: SITE,
  output: 'static',
  compressHTML: true,
  markdown: {
    processor: satteri({
      // Parse raw HTML in pieces (the author's-note <aside>) into elements so plugins see it too.
      features: { rawHtml: true },
    }),
  },
  integrations: [vue()],
})
