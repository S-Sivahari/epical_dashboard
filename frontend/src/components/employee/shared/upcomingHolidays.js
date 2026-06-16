import { addDays, startOfDay } from 'date-fns'

export const HOLIDAY_WINDOW_DAYS = 30

function parseHolidayDate(dateStr) {
  if (!dateStr) return null
  const d = startOfDay(new Date(dateStr))
  return Number.isNaN(d.getTime()) ? null : d
}

export function filterUpcomingHolidays(holidays, windowDays = HOLIDAY_WINDOW_DAYS) {
  const today = startOfDay(new Date())
  const end = addDays(today, windowDays)

  return (Array.isArray(holidays) ? holidays : [])
    .filter((h) => {
      if (h.skipped) return false
      const d = parseHolidayDate(h.date)
      return d && d >= today && d <= end
    })
    .sort((a, b) => parseHolidayDate(a.date) - parseHolidayDate(b.date))
}
