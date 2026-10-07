// Text and voice helpers for the Listen player (docs/AUDIO.md). Pure; copied from blog.moriel.tech.

const ABBREVIATIONS: [RegExp, string][] = [
  [/\be\.g\./gi, 'for example'],
  [/\bi\.e\./gi, 'that is'],
  [/\betc\./gi, 'etcetera'],
  [/\bvs\.?(?=\s)/gi, 'versus'],
]

/**
 * Plain text that speech engines read smoothly; the page keeps its typography.
 * Android's engine pauses at curly quotes and apostrophes as if a sentence ended there.
 */
export function normalizeForSpeech(text: string) {
  let spoken = text
    .replace(/[‘’‚‛′`]/g, "'")
    .replace(/[“”„‟″"«»]/g, '')
    .replace(/(\d)\s*[–—-]\s*(\d)/g, '$1 to $2')
    .replace(/\s*[—–]\s*|\s+-\s+/g, ', ')
    .replace(/…/g, '...')
    .replace(/\s&\s/g, ' and ')
  for (const [pattern, replacement] of ABBREVIATIONS) spoken = spoken.replace(pattern, replacement)
  return spoken
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([,.!?;:]),/g, '$1')
    .replace(/^[,\s]+/, '')
    .trim()
}

interface VoiceLike {
  name: string
  lang: string
  default: boolean
}

/** Voices for the page's language, best first. The browser's default is rarely its best voice. */
export function rankVoices<V extends VoiceLike>(voices: V[], pageLang: string) {
  const language = pageLang.split('-')[0].toLowerCase()
  const normalizedLang = (voice: V) => voice.lang.toLowerCase().replace('_', '-')
  const score = (voice: V) =>
    (/natural|neural|enhanced|premium/i.test(voice.name) ? 4 : 0) +
    (/google/i.test(voice.name) ? 2 : 0) +
    (normalizedLang(voice) === `${language}-us` ? 1 : 0) +
    (voice.default ? 0.5 : 0)
  return voices
    .filter((voice) => normalizedLang(voice).startsWith(language))
    .sort((a, b) => score(b) - score(a))
}

// Speech engines at rate 1 speak slower than people read silently.
const SPOKEN_WORDS_PER_MINUTE = 160

export function getListeningMinutes(words: number, rate: number) {
  return Math.max(1, Math.round(words / (SPOKEN_WORDS_PER_MINUTE * rate)))
}
