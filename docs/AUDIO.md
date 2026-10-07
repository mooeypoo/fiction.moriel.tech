# Listen audio

Pieces are read aloud by the Listen player, built the same way as on [blog.moriel.tech](https://blog.moriel.tech). When a piece has generated audio (Kokoro, a natural-sounding open-source voice), the player plays it; otherwise it falls back to the reader's browser voice.

## How it works

- **What gets read:** the piece's title and its text, cleaned up for speech (quotes and dashes normalized, abbreviations expanded). Screen-reader-only text is skipped. Poem lines that don't end in punctuation get a short pause, so a stanza isn't read as one run-on sentence. The player, the generator, and CI all use the same extraction (`src/lib/listen-text.ts`).
- **Fingerprint:** each piece's spoken text is hashed (SHA-256). Audio is tied to that hash, so it only plays while the text matches what was recorded. Edits that change the text make the player fall back to the browser voice until new audio is published; edits that don't (tags, excerpt, other frontmatter) change nothing.
- **Per paragraph:** each paragraph's (or stanza's) audio is stored separately (`segments/`), named by a hash of everything that affects its sound. A piece's MP3 is its paragraphs joined, so **an edit only regenerates the paragraphs it changed**.
- **Where audio lives:** this repo's GitHub Pages site, `https://mooeypoo.github.io/fiction.moriel.tech/`, deployed by GitHub Actions. It holds one MP3 per piece, the paragraph segments, and `manifest.json`. **Nothing is committed to git:** each run downloads the published segments, generates only missing ones, and redeploys. If the site were ever wiped, a full run regenerates everything.
- **When audio is made:** by the **Listen audio** workflow after every push to `main` that can change the text: about 6 seconds per paragraph on GitHub's runners. Runs queue rather than overlap, and generated paragraphs are cached even when a run fails, so the next one resumes.
- **Heads-up on PRs:** the build check's summary lists which pieces' audio will be generated after merge. It can also be run by hand from the Actions tab (**Run workflow**), optionally naming pieces to regenerate or `all`.
- **Voice:** Kokoro `af_heart`, run on GitHub's machines (no paid service).
- **Opting out:** `listen: false` in a piece's frontmatter removes the player and skips generation. Unlisted pieces are generated too (they have a player); drafts aren't built, so they never are.

## Generate locally (preview only)

Publishing always goes through the workflow. To listen to a piece's generated audio before merging:

```bash
npm run build
npm run audio:install          # once; installs the generator's own dependencies (~400 MB)
npm run audio -- <slug>        # writes tools/listen-audio/out/<slug>-<hash>.mp3
npm run audio -- --plan --from https://mooeypoo.github.io/fiction.moriel.tech/
                               # lists what the workflow would generate or remove
```

The first run downloads the voice model (~330 MB) into `tools/listen-audio/.cache`.

## One-time setup

- [ ] **Settings → Pages → Source: GitHub Actions** in the `fiction.moriel.tech` repo. Until the first run publishes, every piece uses the browser voice (and the browser console shows a 404 for `manifest.json`, which is expected).
- [ ] The repo must be public for GitHub Pages on a free plan.
