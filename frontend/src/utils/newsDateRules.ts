export const PAST_NEWS_DATE_HINT =
  'Only past dates can be added — choose yesterday or an earlier date (not today or future).'

/** Shorter copy for the inline fetch bar */
export const FETCH_PAST_NEWS_DATE_HINT = 'Past dates only — yesterday or earlier.'

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function yesterdayDateInputValue(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - 1)
  return toDateInputValue(d)
}

export function todayDateInputValue(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return toDateInputValue(d)
}

/** Latest selectable date for news (yesterday). */
export function maxPastNewsDateInputValue(): string {
  return yesterdayDateInputValue()
}

export function isPastNewsDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return value <= maxPastNewsDateInputValue()
}

export function isValidNewsDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}

export function publishedAtIsoFromDateInput(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00`).toISOString()
}
