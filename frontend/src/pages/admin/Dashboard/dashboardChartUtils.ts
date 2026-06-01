export type ChartPeriod = 'This Week' | 'This Month' | 'Last Month' | 'Last 2 Months'

export const CHART_PERIODS: ChartPeriod[] = [
  'This Week',
  'This Month',
  'Last Month',
  'Last 2 Months',
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function formatDateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function getChartRange(period: ChartPeriod) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let start = new Date(today)
  let end = new Date(today)

  switch (period) {
    case 'This Week': {
      const day = today.getDay()
      const diffToMon = day === 0 ? -6 : 1 - day
      start.setDate(today.getDate() + diffToMon)
      end = new Date(start)
      end.setDate(start.getDate() + 6)
      break
    }
    case 'This Month':
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      break
    case 'Last Month':
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      end = new Date(today.getFullYear(), today.getMonth(), 0)
      break
    case 'Last 2 Months':
      end = new Date(today)
      start = new Date(today.getFullYear(), today.getMonth() - 2, 1)
      break
  }

  return { from: formatDateKey(start), to: formatDateKey(end) }
}

function hoursFromTimesheet(t: { loginTime?: string; logoutTime?: string; overriddenHours?: number }) {
  if (t.overriddenHours != null) return Number(t.overriddenHours)
  if (!t.loginTime || !t.logoutTime) return 0
  return (
    Math.round(
      ((new Date(t.logoutTime).getTime() - new Date(t.loginTime).getTime()) / 3600000) * 10,
    ) / 10
  )
}

export function aggregateChartData(
  timesheets: Array<{ loginTime?: string; logoutTime?: string; overriddenHours?: number }>,
  period: ChartPeriod,
) {
  if (period === 'This Week') {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const byDay: Record<string, number> = {}

    timesheets.forEach((t) => {
      if (!t.loginTime) return
      const key = dayNames[new Date(t.loginTime).getDay()]
      byDay[key] = (byDay[key] || 0) + hoursFromTimesheet(t)
    })

    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((name) => ({
      name,
      hours: Math.round((byDay[name] || 0) * 10) / 10,
    }))
  }

  const range = getChartRange(period)
  const buckets: { name: string; start: Date; end: Date }[] = []
  let cursor = new Date(`${range.from}T00:00:00`)
  const rangeEnd = new Date(`${range.to}T23:59:59`)

  while (cursor <= rangeEnd) {
    const bucketStart = new Date(cursor)
    const bucketEnd = new Date(cursor)
    bucketEnd.setDate(bucketEnd.getDate() + 6)
    if (bucketEnd > rangeEnd) bucketEnd.setTime(rangeEnd.getTime())

    buckets.push({
      name: bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      start: bucketStart,
      end: bucketEnd,
    })

    cursor.setDate(cursor.getDate() + 7)
  }

  return buckets.map((b) => {
    let hours = 0
    timesheets.forEach((t) => {
      if (!t.loginTime) return
      const d = new Date(t.loginTime)
      if (d >= b.start && d <= b.end) {
        hours += hoursFromTimesheet(t)
      }
    })
    return { name: b.name, hours: Math.round(hours * 10) / 10 }
  })
}

export function getChartSubtitle(period: ChartPeriod) {
  switch (period) {
    case 'This Week':
      return 'Hours logged this week (Mon–Sun)'
    case 'This Month':
      return 'Hours logged this month by week'
    case 'Last Month':
      return 'Hours logged last month by week'
    case 'Last 2 Months':
      return 'Hours logged over the last two months by week'
    default:
      return 'Hours logged'
  }
}
