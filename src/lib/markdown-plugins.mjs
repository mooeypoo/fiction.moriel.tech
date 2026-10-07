// @ts-check
// Sätteri (Markdown) plugins for pieces and pages.
/** @typedef {import('satteri').HastPluginEntry} HastPluginEntry */

/** @param {unknown} value */
function toList(value) {
  if (Array.isArray(value)) return value
  return typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : []
}

/** @param {any} node */
function clone(node) {
  if (node.type !== 'element') return { ...node }
  return { ...node, properties: { ...node.properties }, children: (node.children ?? []).map(clone) }
}

/**
 * Each line of a paragraph with line breaks gets its own <span class="line">, so a poem's long
 * lines can wrap with a hanging indent. The <br>s stay; prose looks the same as without it.
 * @type {HastPluginEntry}
 */
export const wrapLines = {
  name: 'wrap-lines',
  element: {
    filter: ['p'],
    visit(node, ctx) {
      const children = /** @type {any[]} */ (node.children ?? [])
      const isBreak = (/** @type {any} */ child) => child.type === 'element' && child.tagName === 'br'
      if (!children.some(isBreak)) return

      /** @type {any[]} */
      const lines = []
      /** @type {any[]} */
      let line = []
      const endLine = () => {
        lines.push({ type: 'element', tagName: 'span', properties: { className: ['line'] }, children: line })
        line = []
      }
      for (const child of children) {
        if (isBreak(child)) {
          endLine()
          lines.push(clone(child))
        } else {
          line.push(clone(child))
        }
      }
      endLine()
      ctx.replaceNode(node, { type: 'element', tagName: 'p', properties: { ...node.properties }, children: lines })
    },
  },
}

/**
 * Links to other sites open a new tab and say so, as on blog.moriel.tech.
 * @param {string} site
 * @returns {HastPluginEntry}
 */
export function openExternalLinksInNewTab(site) {
  const host = new URL(site).hostname
  return {
    name: 'open-external-links-in-new-tab',
    element: {
      filter: ['a'],
      visit(node, ctx) {
        const href = node.properties?.href
        if (typeof href !== 'string' || !/^(https?:)?\/\//i.test(href) || new URL(href, site).hostname === host) return

        ctx.setProperty(node, 'target', '_blank')
        ctx.setProperty(node, 'rel', [...new Set([...toList(node.properties?.rel), 'noopener', 'noreferrer'])].join(' '))
        ctx.setProperty(node, 'className', [...toList(node.properties?.className), 'external-link'])
        // The icon is decorative CSS, so screen readers get the warning as text.
        ctx.appendChild(node, {
          type: 'element',
          tagName: 'span',
          properties: { className: ['sr-only'] },
          children: [{ type: 'text', value: ' (opens in a new tab)' }],
        })
      },
    },
  }
}
