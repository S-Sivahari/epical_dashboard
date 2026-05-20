import { format, parseISO } from 'date-fns'

export function formatDate(value: string | Date, pattern = 'dd MMM yyyy') {
  const d = typeof value === 'string' ? parseISO(value) : value
  return format(d, pattern)
}

export function formatDateTime(value: string | Date) {
  return formatDate(value, 'dd MMM yyyy, HH:mm')
}
