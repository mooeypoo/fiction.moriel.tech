// A line-for-line port of WordPress's wpautop() (wp-includes/formatting.php), which turned
// the stored post text into the HTML readers saw: blank lines become paragraphs, single
// newlines become <br />. compare.ts checks it against the PHP original.

const ALL_BLOCKS =
  '(?:table|thead|tfoot|caption|col|colgroup|tbody|tr|td|th|div|dl|dd|dt|ul|ol|li|pre|form|map|area|blockquote|address|style|p|h[1-6]|hr|fieldset|legend|section|article|aside|hgroup|header|footer|nav|figure|figcaption|details|menu|summary)'

/** wp_html_split(): text and tags alternate; tags (comments, CDATA, elements) at odd indexes. */
function splitHtml(input: string) {
  const parts: string[] = []
  let text = ''
  let i = 0
  while (i < input.length) {
    if (input[i] !== '<') {
      text += input[i++]
      continue
    }
    let end: number
    if (input.startsWith('<!--', i)) {
      const close = input.indexOf('-->', i + 4)
      end = close === -1 ? input.length : close + 3
    } else if (input.startsWith('<![CDATA[', i)) {
      const close = input.indexOf(']]>', i + 9)
      end = close === -1 ? input.length : close + 3
    } else {
      const close = input.indexOf('>', i + 1)
      end = close === -1 ? input.length : close + 1
    }
    parts.push(text, input.slice(i, end))
    text = ''
    i = end
  }
  parts.push(text)
  return parts
}

function replaceNewlinesInTags(haystack: string) {
  const parts = splitHtml(haystack)
  for (let i = 1; i < parts.length; i += 2) parts[i] = parts[i].replaceAll('\n', ' <!-- wpnl --> ')
  return parts.join('')
}

export function wpautop(input: string, br = true) {
  if (input.trim() === '') return ''
  let text = input + '\n'

  // The export has no <pre>; WordPress's placeholder dance for it is left out.
  if (text.includes('<pre')) throw new Error('wpautop port: <pre> is not supported')

  text = text.replace(/<br\s*\/?>\s*<br\s*\/?>/g, '\n\n')
  text = text.replace(new RegExp(`(<${ALL_BLOCKS}[\\s/>])`, 'g'), '\n\n$1')
  text = text.replace(new RegExp(`(</${ALL_BLOCKS}>)`, 'g'), '$1\n\n')
  text = text.replace(/(<hr\s*?\/?>)/g, '$1\n\n')
  text = text.replace(/\r\n|\r/g, '\n')
  text = replaceNewlinesInTags(text)

  if (text.includes('<option')) {
    text = text.replace(/\s*<option/g, '<option').replace(/<\/option>\s*/g, '</option>')
  }
  if (text.includes('</object>') || text.includes('<source') || text.includes('<track')) {
    throw new Error('wpautop port: <object>, <source>, and <track> are not supported')
  }
  if (text.includes('<figcaption')) {
    text = text.replace(/\s*(<figcaption[^>]*>)/g, '$1').replace(/<\/figcaption>\s*/g, '</figcaption>')
  }

  text = text.replace(/\n\n+/g, '\n\n')
  const paragraphs = text.split(/\n\s*\n/).filter((paragraph) => paragraph !== '')
  text = paragraphs.map((paragraph) => `<p>${paragraph.replace(/^\n+|\n+$/g, '')}</p>\n`).join('')

  text = text.replace(/<p>\s*<\/p>/g, '')
  text = text.replace(/<p>([^<]+)<\/(div|address|form)>/g, '<p>$1</p></$2>')
  text = text.replace(new RegExp(`<p>\\s*(</?${ALL_BLOCKS}[^>]*>)\\s*</p>`, 'g'), '$1')
  text = text.replace(/<p>(<li.+?)<\/p>/g, '$1')
  text = text.replace(/<p><blockquote((?:[^>"']|"[^"]*"|'[^']*')*)>/gi, '<blockquote$1><p>')
  text = text.replaceAll('</blockquote></p>', '</p></blockquote>')
  text = text.replace(new RegExp(`<p>\\s*(</?${ALL_BLOCKS}[^>]*>)`, 'g'), '$1')
  text = text.replace(new RegExp(`(</?${ALL_BLOCKS}[^>]*>)\\s*</p>`, 'g'), '$1')

  if (br) {
    text = text.replace(/<(script|style|svg|math).*?<\/\1>/gs, (match) => match.replaceAll('\n', '<WPPreserveNewline />'))
    text = text.replaceAll('<br>', '<br />').replaceAll('<br/>', '<br />')
    text = text.replace(/(?<!<br \/>)\s*\n/g, '<br />\n')
    text = text.replaceAll('<WPPreserveNewline />', '\n')
  }

  text = text.replace(new RegExp(`(</?${ALL_BLOCKS}[^>]*>)\\s*<br />`, 'g'), '$1')
  text = text.replace(/<br \/>(\s*<\/?(?:p|li|div|dl|dd|dt|th|pre|td|ul|ol)[^>]*>)/g, '$1')
  // PHP's `$` also matches before a final newline.
  text = text.replace(/\n<\/p>(?=\n?$)/, '</p>')

  if (text.includes('<!-- wpnl -->')) text = text.replaceAll(' <!-- wpnl --> ', '\n').replaceAll('<!-- wpnl -->', '\n')
  return text
}
