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

export type NoteDescriptionMode = 'paragraph' | 'points'

export function inferDescriptionMode(text: string): NoteDescriptionMode {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return lines.length > 1 ? 'points' : 'paragraph'
}

export function plainTextToPoints(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^[-–—]\s*/, '').trim())
    .filter(Boolean)
}

export function pointsToPlainText(points: string[]): string {
  return points.map((point) => point.trim()).filter(Boolean).join('\n')
}

export function descriptionModeToPlainText(
  mode: NoteDescriptionMode,
  paragraph: string,
  points: string[],
): string {
  if (mode === 'points') return pointsToPlainText(points)
  return paragraph.trim()
}

/** Notepad / email line prefix for work updates. */
export function formatNoteDisplayLine(line: string): string {
  const trimmed = line.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('--') ? trimmed : `-- ${trimmed}`
}
