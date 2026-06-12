import type { ReactNode } from 'react'

export function escapeHighlightRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function stripHtmlText(html: string): string {
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const template = document.createElement('div')
  template.innerHTML = html
  return (template.textContent || template.innerText || '').replace(/\s+/g, ' ').trim()
}

export function highlightPlainText(text: string, query: string): ReactNode {
  const trimmed = query.trim()
  if (!trimmed || !text) return text

  const regex = new RegExp(`(${escapeHighlightRegex(trimmed)})`, 'gi')
  const parts = text.split(regex)

  return parts.map((part, index) => {
    if (!part) return null
    const isMatch = part.toLowerCase() === trimmed.toLowerCase()
    return isMatch ? (
      <mark key={`${part}-${index}`} className="admin-notes-highlight">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  })
}
