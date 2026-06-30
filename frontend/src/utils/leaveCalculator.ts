import { eachIsoDateInRange, isWeekendIso } from '@/utils/dateValidation'

export type LeaveHoliday = { date: string }

function normalizeHolidayDate(date: string): string {
  return date.trim().slice(0, 10)
}

/** Working days between two dates, excluding weekends and holidays. */
export function getBusinessDays(
  from: string,
  to: string,
  holidays: LeaveHoliday[] = [],
): number {
  const dates = eachIsoDateInRange(from, to)
  if (dates.length === 0) return 0

  const holidayDates = new Set(holidays.map((h) => normalizeHolidayDate(h.date)))
  let count = 0

  for (const iso of dates) {
    if (!isWeekendIso(iso) && !holidayDates.has(iso)) {
      count++
    }
  }

  return count
}

export function getRequestedLeaveDays(
  leaveDuration: 'Full Day' | 'Half Day',
  from: string,
  to: string,
  holidays: LeaveHoliday[] = [],
): number {
  if (leaveDuration === 'Half Day') {
    return getBusinessDays(from, to, holidays) === 1 ? 0.5 : 0
  }
  return getBusinessDays(from, to, holidays)
}

function isoDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** True when casual leave is being applied on the same day as the leave start date. */
export function isCasualSameDayLeave(fromDate: string, appliedAt = new Date()): boolean {
  if (!fromDate || fromDate.length < 10) return false
  const applied =
    appliedAt instanceof Date
      ? isoDateLocal(appliedAt)
      : String(appliedAt).trim().slice(0, 10)
  return fromDate.slice(0, 10) === applied
}

