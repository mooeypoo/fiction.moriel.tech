import { createHash } from 'node:crypto'

// The page follows the system theme in CSS; this only applies a theme the reader chose with the
// toggle. Inlined at the top of <head> so it's set before the first paint, and kept tiny since it
// blocks parsing. Its CSP hash is derived here so the two can't drift apart. try/catch because
// storage access can throw (privacy settings).
export const themeInitScript =
  "try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}"

export const themeInitHash = /** @type {`sha256-${string}`} */ (
  `sha256-${createHash('sha256').update(themeInitScript).digest('base64')}`
)
