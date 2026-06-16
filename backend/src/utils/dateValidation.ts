const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/
export const LEAVE_MAX_ADVANCE_DAYS = 45

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function startOfTodayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function parseIsoDate(iso: string): { valid: boolean; error?: string } {
  if (!iso || !ISO_DATE_REGEX.test(iso)) {
    return { valid: false, error: 'Invalid date format. Use yyyy-mm-dd.' }
  }
  const [, yyyy, mm, dd] = iso.match(ISO_DATE_REGEX)!
  const year = parseInt(yyyy, 10)
  const month = parseInt(mm, 10)
  const day = parseInt(dd, 10)

  if (month < 1 || month > 12) {
    return { valid: false, error: 'Invalid month' }
  }
  if (day < 1 || day > 31) {
    return { valid: false, error: 'Invalid day' }
  }

  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return { valid: false, error: 'Invalid calendar date' }
  }

  return { valid: true }
}

export function parseIsoToLocalDate(iso: string): Date | null {
  if (!ISO_DATE_REGEX.test(iso)) return null;
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatLocalDateIso(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function eachIsoDateInRange(from: string, to: string): string[] {
  const start = parseIsoToLocalDate(from);
  const end = parseIsoToLocalDate(to);
  if (!start || !end || end < start) return [];

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(formatLocalDateIso(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function isWeekendIso(iso: string): boolean {
  const date = parseIsoToLocalDate(iso);
  if (!date) return false;
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

export function validateLeaveDates(from: string, to: string): void {
  const fromParsed = parseIsoDate(from)
  if (!fromParsed.valid) {
    throw new Error(fromParsed.error || 'Invalid start date')
  }
  const toParsed = parseIsoDate(to)
  if (!toParsed.valid) {
    throw new Error(toParsed.error || 'Invalid end date')
  }

  const today = startOfTodayIso()
  const maxDate = addDaysIso(today, LEAVE_MAX_ADVANCE_DAYS)

  if (from < today) {
    throw new Error('Leave cannot be applied for past dates')
  }
  if (to < from) {
    throw new Error('End date must be on or after the start date')
  }
  if (from > maxDate || to > maxDate) {
    throw new Error(`Leave can only be applied up to ${LEAVE_MAX_ADVANCE_DAYS} days in advance`)
  }
}
