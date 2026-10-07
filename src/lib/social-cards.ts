// Social preview cards (og:image), rendered at build time like blog.moriel.tech's: Satori lays
// out the text as SVG, sharp turns it into a JPEG. Typographic only; the site has no images.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import satori from 'satori'
import sharp from 'sharp'

export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630

export interface SocialCard {
  /** Output path under /og/, without extension. */
  path: string
  title: string
  eyebrow?: string
  text?: string
}

export const getCardUrl = (path: string) => `/og/${path}.jpg`

/**
 * WOFF is a TrueType font with zlib-compressed tables. Satori's own WOFF support goes through
 * fflate, pinned to a vulnerable version (patched releases break it), so fonts are unwrapped here.
 */
function woffToTtf(woff: Buffer) {
  const tableCount = woff.readUInt16BE(12)
  const tables = Array.from({ length: tableCount }, (_, i) => {
    const entry = 44 + i * 20
    const offset = woff.readUInt32BE(entry + 4)
    const compressedLength = woff.readUInt32BE(entry + 8)
    const length = woff.readUInt32BE(entry + 12)
    const raw = woff.subarray(offset, offset + compressedLength)
    return { tag: woff.readUInt32BE(entry), checksum: woff.readUInt32BE(entry + 16), data: compressedLength < length ? inflateSync(raw) : raw }
  })

  const power = 2 ** Math.floor(Math.log2(tableCount))
  const header = Buffer.alloc(12 + tableCount * 16)
  header.writeUInt32BE(woff.readUInt32BE(4), 0)
  header.writeUInt16BE(tableCount, 4)
  header.writeUInt16BE(power * 16, 6)
  header.writeUInt16BE(Math.log2(power), 8)
  header.writeUInt16BE(tableCount * 16 - power * 16, 10)

  const body: Buffer[] = []
  let offset = header.length
  tables.forEach((table, i) => {
    header.writeUInt32BE(table.tag, 12 + i * 16)
    header.writeUInt32BE(table.checksum, 16 + i * 16)
    header.writeUInt32BE(offset, 20 + i * 16)
    header.writeUInt32BE(table.data.length, 24 + i * 16)
    const padded = Buffer.alloc(Math.ceil(table.data.length / 4) * 4)
    table.data.copy(padded)
    body.push(padded)
    offset += padded.length
  })
  return Buffer.concat([header, ...body])
}

// Build runs from the project root. Satori can't read WOFF2, so these come from @fontsource.
const fontFile = (name: string) => woffToTtf(readFileSync(join(process.cwd(), 'node_modules/@fontsource', name)))
let fonts: Parameters<typeof satori>[1]['fonts'] | undefined

function loadFonts() {
  fonts ??= [
    { name: 'Fraunces', data: fontFile('fraunces/files/fraunces-latin-600-normal.woff'), weight: 600, style: 'normal' },
    { name: 'Fraunces', data: fontFile('fraunces/files/fraunces-latin-400-italic.woff'), weight: 400, style: 'italic' },
    { name: 'Literata', data: fontFile('literata/files/literata-latin-400-italic.woff'), weight: 400, style: 'italic' },
    { name: 'Literata', data: fontFile('literata/files/literata-latin-600-normal.woff'), weight: 600, style: 'normal' },
  ]
  return fonts
}

const PAPER = '#f7f2e8'
const INK = '#241f1a'
const MUTED = '#675d51'
const ACCENT = '#6a3a8a'

// The site mark (components/PlaneMark.astro) as an image, since Satori draws <img> but not inline SVG.
const MARK = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke-linecap="round"><path d="M3 23h26M9 30V3" stroke="${MUTED}" stroke-width="1.6"/><path d="M25 23A16 16 0 0 0 9 7" stroke="${ACCENT}" stroke-width="2"/><circle cx="25" cy="23" r="1.9" fill="${INK}"/><circle cx="9" cy="7" r="2.9" fill="${ACCENT}"/></svg>`,
)}`

type Node = { type: string; props: { style?: Record<string, unknown>; children?: unknown; src?: string; width?: number; height?: number } }
const el = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({ type, props: { style, children } })

const truncate = (text: string, length: number) => (text.length <= length ? text : `${text.slice(0, length - 1).trimEnd()}…`)

function titleSize(title: string) {
  if (title.length <= 24) return 84
  if (title.length <= 45) return 70
  return 56
}

function layout(card: SocialCard): Node {
  return el(
    'div',
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      display: 'flex',
      flexDirection: 'column',
      padding: '64px 80px',
      background: PAPER,
      borderLeft: `14px solid ${ACCENT}`,
      color: INK,
      fontFamily: 'Literata',
    },
    [
      el('div', { fontSize: 26, fontWeight: 600, letterSpacing: 4, textTransform: 'uppercase', color: ACCENT }, card.eyebrow ?? ' '),
      el('div', { display: 'flex', flexDirection: 'column', justifyContent: 'center', flexGrow: 1 }, [
        el('div', { fontFamily: 'Fraunces', fontWeight: 600, fontSize: titleSize(card.title), lineHeight: 1.1, maxWidth: 1000 }, truncate(card.title, 80)),
        card.text
          ? el('div', { marginTop: 28, fontSize: 32, fontStyle: 'italic', lineHeight: 1.45, color: MUTED, maxWidth: 940 }, truncate(card.text, 150))
          : null,
      ].filter(Boolean)),
      el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `2px solid #d9cdb8`, paddingTop: 24 }, [
        el('div', { display: 'flex', alignItems: 'center' }, [
          { type: 'img', props: { src: MARK, width: 44, height: 44, style: { marginRight: 16 } } },
          el('div', { display: 'flex', fontFamily: 'Fraunces', fontSize: 34, fontWeight: 600 }, [
            el('span', { fontStyle: 'italic', fontWeight: 400, marginRight: 10 }, 'Imaginary'),
            'Parts',
          ]),
        ]),
        el('div', { fontSize: 26, color: MUTED }, 'fiction.moriel.tech'),
      ]),
    ],
  )
}

export async function renderCard(card: SocialCard) {
  const svg = await satori(layout(card) as never, { width: CARD_WIDTH, height: CARD_HEIGHT, fonts: loadFonts() })
  return sharp(Buffer.from(svg)).jpeg({ quality: 88, mozjpeg: true }).toBuffer()
}
