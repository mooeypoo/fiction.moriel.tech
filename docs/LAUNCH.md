# Launch checklist

What's left before fiction.moriel.tech fully replaces the WordPress site at lit.smarterthanthat.com. Tick items off in the same PR that does them.

## Before the switch

- [ ] **Netlify:** the repo is connected and fiction.moriel.tech points at it. Build settings come from `netlify.toml`.
- [x] **About page:** rewritten, published, and in the header nav.
- [ ] **Dead link:** "The Summer I was Seventeen" links to ESRA Magazine, whose domain is now for sale. Unlink it, or point it at an archived copy.
- [ ] **Old links (optional):** the loc.gov, americanpoems.com, and Stony Brook links in the pieces still work, but through redirects; they can be updated to their current URLs.
- [ ] **Images (optional):** none were migrated. The old ones, with their alt text and credits, are listed in `tools/wp-import/report.json`. New ones go in `src/assets/`.
- [ ] **The unpublished draft** "Lieutenant Civilian and Military Police" is only in the WordPress export. Decide whether to bring it over (as `draft: true`, which is still readable on GitHub) or keep it elsewhere.
- [ ] **Plausible:** add fiction.moriel.tech as a site. The script is already on every page (`src/layouts/BaseLayout.astro`).

## The switch

- [ ] **Back up WordPress** one last time: a fresh export, plus the uploads folder if you want the original images. Keep both private; the export holds commenters' emails and IP addresses.
- [ ] **Domain alias:** in Netlify, Domain management → add `lit.smarterthanthat.com` as a domain alias, and point its DNS at Netlify. The redirects in `public/_redirects` only apply from then on.
- [ ] **Check the redirects** once the alias has its HTTPS certificate. Each should return a `301` with the right `Location`:

  ```bash
  curl -sI https://lit.smarterthanthat.com/prose/the-box/        # → /pieces/the-box/
  curl -sI "https://lit.smarterthanthat.com/?p=17"               # → /p/17, then /pieces/one-million/
  curl -sI https://lit.smarterthanthat.com/category/poem/        # → /poems/
  curl -sI http://lit.smarterthanthat.com/feed/                  # → /rss.xml
  ```

- [ ] **Search engines:** in Google Search Console, verify both domains, use **Change of address** from lit.smarterthanthat.com to fiction.moriel.tech, and submit `https://fiction.moriel.tech/sitemap-index.xml`.
- [ ] **Shut down WordPress** once the checks pass.

## After the switch

- [ ] **Keep lit.smarterthanthat.com registered** and its DNS on Netlify for as long as old links might be out there (years, ideally), or the redirects stop working.
