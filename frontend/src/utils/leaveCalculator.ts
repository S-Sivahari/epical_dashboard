export type LeaveHoliday = { date: string }

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Working days between two dates, excluding weekends and holidays. */
export function getBusinessDays(
  from: string,
  to: string,
  holidays: LeaveHoliday[] = [],
): number {
  const start = from.slice(0, 10)
  const end = to.slice(0, 10)
  if (!start || !end || end < start) return 0

  const holidayDates = new Set(holidays.map((h) => h.date))
  let count = 0

  for (let cur = start; cur <= end; cur = addDaysIso(cur, 1)) {
    const [y, m, d] = cur.split('-').map(Number)
    const dayOfWeek = new Date(y, m - 1, d).getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(cur)) {
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

export function isCasualSameDayLeave(fromDate: string, refDate = new Date()): boolean {
  if (!fromDate || fromDate.length < 10) return false
  const y = refDate.getFullYear()
  const m = String(refDate.getMonth() + 1).padStart(2, '0')
  const d = String(refDate.getDate()).padStart(2, '0')
  return fromDate.slice(0, 10) === `${y}-${m}-${d}`
}
