import { getWeekRange, isDateInRange } from '@pages/employee/lib/dateFilters'

const CHART_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function hoursFromMs(ms) {
  return Math.round((ms / 3600000) * 10) / 10
}

export function getDayKey(date) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]
}

/** Sum workedMs from completed timesheet rows (same value saved at checkout). */
export function buildWeeklyHoursChartData(sessions, { weekRange } = {}) {
  const range = weekRange ?? getWeekRange()
  const byDay = {}

  ;(sessions ?? []).forEach((session) => {
    if (!session?.date || !isDateInRange(session.date, range.start, range.end)) return
    if (!session.logoutTime) return
    if (typeof session.workedMs !== 'number' || session.workedMs < 0) return
    const key = getDayKey(new Date(`${session.date}T12:00:00`))
    byDay[key] = (byDay[key] || 0) + hoursFromMs(session.workedMs)
  })

  return CHART_DAYS.map((day) => ({
    day,
    hours: Math.round((byDay[day] || 0) * 10) / 10,
    target: 8,
  }))
}

export function todayHoursFromChart(weeklyHours, date = new Date()) {
  const todayKey = getDayKey(date)
  return weeklyHours.find((row) => row.day === todayKey)?.hours ?? 0
}

export function totalWeeklyHoursFromChart(weeklyHours) {
  return weeklyHours.reduce((sum, row) => sum + row.hours, 0)
}
