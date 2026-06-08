export type LeaveHoliday = { date: string }

/** Working days between two dates, excluding weekends and holidays. */
export function getBusinessDays(
  from: string,
  to: string,
  holidays: LeaveHoliday[] = [],
): number {
  const start = new Date(from)
  const end = new Date(to)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0
  }

  const holidayDates = new Set(holidays.map((h) => h.date))
  let count = 0

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay()
    const dateString = d.toISOString().split('T')[0]
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateString)) {
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
