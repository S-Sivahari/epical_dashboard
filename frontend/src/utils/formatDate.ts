import { format, parseISO } from 'date-fns'

export function formatDate(value: string | Date, pattern = 'dd MMM yyyy') {
  try {
    const d = typeof value === 'string' ? parseISO(value) : value
    return format(d, pattern)
  } catch {
    // If date parsing fails, return the original value
    return typeof value === 'string' ? value : String(value)
  }
}

export function formatDateTime(value: string | Date) {
  return formatDate(value, 'dd MMM yyyy, HH:mm')
}
