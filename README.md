# Imaginary Parts

*Stories, flash fiction, and the occasional poem.*

The source of [fiction.moriel.tech](https://fiction.moriel.tech): a static [Astro](https://astro.build) site, written in Markdown, deployed on Netlify. It replaces the WordPress site at lit.smarterthanthat.com.

```bash
npm ci
npm run dev        # local dev server
npm test           # unit tests
npm run build      # the static site, in dist/
npm run test:site  # checks on the built site
```

- [docs/FRONTMATTER.md](docs/FRONTMATTER.md): every field a piece or page can use.
- [docs/AUDIO.md](docs/AUDIO.md): the Listen audio, and its one-time setup.
- [AGENTS.md](AGENTS.md): layout, conventions, and what's easy to break.
- `tools/wp-import/`: the one-off WordPress migration, kept for reference.
