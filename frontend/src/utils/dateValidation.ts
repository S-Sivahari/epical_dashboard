import { addDays, format, parseISO, startOfDay } from 'date-fns'

export const DD_MM_YYYY_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/
export const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/

export const LEAVE_MAX_ADVANCE_DAYS = 90

export type DateParseResult =
  | { valid: true; iso: string }
  | { valid: false; error: string }

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Format raw digits into dd/mm/yyyy while typing (max 8 digits). */
export function formatDigitsAsDdMmYyyy(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export function isoToDdMmYyyy(iso: string): string {
  if (!iso || !ISO_DATE_REGEX.test(iso)) return ''
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

export function parseIsoDate(iso: string): DateParseResult {
  if (!iso || !ISO_DATE_REGEX.test(iso)) {
    return { valid: false, error: 'Use dd/mm/yyyy format (e.g. 26/05/2026)' }
  }
  const [, yyyy, mm, dd] = iso.match(ISO_DATE_REGEX)!
  return validateCalendarParts(parseInt(dd, 10), parseInt(mm, 10), parseInt(yyyy, 10))
}

export function parseDdMmYyyy(value: string): DateParseResult {
  const trimmed = value.trim()
  if (!trimmed) {
    return { valid: false, error: 'Date is required' }
  }
  if (!DD_MM_YYYY_REGEX.test(trimmed)) {
    return { valid: false, error: 'Use dd/mm/yyyy format (e.g. 26/05/2026)' }
  }
  const [, dd, mm, yyyy] = trimmed.match(DD_MM_YYYY_REGEX)!
  return validateCalendarParts(parseInt(dd, 10), parseInt(mm, 10), parseInt(yyyy, 10))
}

function validateCalendarParts(day: number, month: number, year: number): DateParseResult {
  if (month < 1 || month > 12) {
    return { valid: false, error: 'Invalid month (must be 01–12)' }
  }
  if (day < 1 || day > 31) {
    return { valid: false, error: 'Invalid day (must be 01–31)' }
  }
  if (year < 2000 || year > 2100) {
    return { valid: false, error: 'Year must be between 2000 and 2100' }
  }

  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return { valid: false, error: 'Invalid calendar date' }
  }

  return { valid: true, iso: `${year}-${pad2(month)}-${pad2(day)}` }
}

export function startOfTodayIso(): string {
  return format(startOfDay(new Date()), 'yyyy-MM-dd')
}

export function getLeaveDateBounds(): { min: string; max: string } {
  const today = startOfDay(new Date())
  return {
    min: format(today, 'yyyy-MM-dd'),
    max: format(addDays(today, LEAVE_MAX_ADVANCE_DAYS), 'yyyy-MM-dd'),
  }
}

/** Admin holiday / event forms — current year through two years ahead. */
export function getCalendarEntryBounds(): { min: string; max: string } {
  const year = new Date().getFullYear()
  return {
    min: `${year}-01-01`,
    max: `${year + 2}-12-31`,
  }
}

/** Historical filters — any valid date in a wide range. */
export function getFilterDateBounds(): { min: string; max: string } {
  return { min: '2000-01-01', max: '2100-12-31' }
}

export function isIsoInRange(iso: string, min?: string, max?: string): boolean {
  if (!ISO_DATE_REGEX.test(iso)) return false
  if (min && iso < min) return false
  if (max && iso > max) return false
  return true
}

export function validateIsoInRange(
  iso: string,
  min?: string,
  max?: string,
): DateParseResult {
  const parsed = parseIsoDate(iso)
  if (!parsed.valid) return parsed

  if (min && parsed.iso < min) {
    return {
      valid: false,
      error: `Date cannot be before ${isoToDdMmYyyy(min)}`,
    }
  }
  if (max && parsed.iso > max) {
    return {
      valid: false,
      error: `Date cannot be after ${isoToDdMmYyyy(max)}`,
    }
  }
  return parsed
}

export function leaveRangeError(fromIso: string, toIso: string): string | null {
  const bounds = getLeaveDateBounds()
  const fromCheck = validateIsoInRange(fromIso, bounds.min, bounds.max)
  if (!fromCheck.valid) return fromCheck.error

  const toCheck = validateIsoInRange(toIso, bounds.min, bounds.max)
  if (!toCheck.valid) return toCheck.error

  if (toIso < fromIso) {
    return 'End date must be on or after the start date'
  }
  return null
}

export function formatIsoForDisplay(iso: string): string {
  try {
    return format(parseISO(iso), 'dd/MM/yyyy')
  } catch {
    return isoToDdMmYyyy(iso)
  }
}
