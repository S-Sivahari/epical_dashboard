export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Store notepad lines as simple HTML for email + API compatibility. */
export function plainTextToNoteHtml(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  return `<div class="notes-plain-body" style="white-space:pre-wrap;font-family:inherit;line-height:1.55;">${escapeHtml(text)}</div>`
}

export function noteHtmlToPlainText(html: string): string {
  if (!html?.trim()) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
