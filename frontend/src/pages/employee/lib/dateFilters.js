function pad(n) {
  return String(n).padStart(2, '0')
}

export function formatDateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Monday–Sunday range containing the given date (YYYY-MM-DD). */
export function getWeekRange(date = new Date()) {
  const day = date.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMon)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { start: formatDateKey(monday), end: formatDateKey(sunday) }
}

/** Default load window for history (2 years back through today). */
export function getHistoryLoadRange(yearsBack = 2) {
  const end = formatDateKey(new Date())
  const startDate = new Date()
  startDate.setFullYear(startDate.getFullYear() - yearsBack)
  return { start: formatDateKey(startDate), end, label: `Last ${yearsBack} years` }
}

/** Date range for quick presets (matches admin timesheet picker). */
export function getPresetDateRange(preset) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let start = new Date(today)
  let end = new Date(today)

  switch (preset) {
    case 'Today':
      break
    case 'Yesterday':
      start.setDate(today.getDate() - 1)
      end.setDate(today.getDate() - 1)
      break
    case 'This Week': {
      const day = today.getDay()
      const diffToMon = day === 0 ? -6 : 1 - day
      start.setDate(today.getDate() + diffToMon)
      end = new Date(start)
      end.setDate(start.getDate() + 6)
      break
    }
    case 'Last Week': {
      const day = today.getDay()
      const diffToMon = day === 0 ? -6 : 1 - day
      start.setDate(today.getDate() + diffToMon - 7)
      end = new Date(start)
      end.setDate(start.getDate() + 6)
      break
    }
    case 'Past Two Weeks':
      start.setDate(today.getDate() - 13)
      break
    case 'This Month':
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      break
    case 'Last Month':
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      end = new Date(today.getFullYear(), today.getMonth(), 0)
      break
    case 'This Year':
      start = new Date(today.getFullYear(), 0, 1)
      end = new Date(today.getFullYear(), 11, 31)
      break
    case 'Last Year':
      start = new Date(today.getFullYear() - 1, 0, 1)
      end = new Date(today.getFullYear() - 1, 11, 31)
      break
    default:
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  }

  return { start: formatDateKey(start), end: formatDateKey(end) }
}

export function isDateInRange(dateKey, start, end) {
  if (!dateKey) return false
  return dateKey >= start && dateKey <= end
}
