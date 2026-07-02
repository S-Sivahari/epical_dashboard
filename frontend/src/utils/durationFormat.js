/**
 * Shared duration helpers for timesheet UI.
 */

export function computeWorkedMs(loginTime, logoutTime, totalPausedMs = 0) {
  const start = loginTime instanceof Date ? loginTime.getTime() : new Date(loginTime).getTime()
  const end = logoutTime instanceof Date ? logoutTime.getTime() : new Date(logoutTime).getTime()
  const paused = totalPausedMs || 0
  return Math.max(0, end - start - paused)
}

export function formatDurationFromMs(ms) {
  const safeMs = Math.max(0, Math.floor(ms))
  const totalMinutes = Math.floor(safeMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0 && minutes === 0) return '0m'
  if (hours === 0) return `${minutes}m`
  const minPart = String(minutes).padStart(2, '0')
  return `${hours}h ${minPart}m`
}

/** Whole minutes from decimal hours (for charts and summaries). */
export function hoursToMinutes(hours) {
  const n = Number(hours)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n * 60)
}

/** Format decimal hours like live session stats: "6m", "1h 30m". */
export function formatHoursAsDuration(hours) {
  return formatDurationFromMs(hoursToMinutes(hours) * 60000)
}

/** Chart axis tick from hour-scale values. */
export function formatChartAxisMinutesFromHours(hours) {
  return `${hoursToMinutes(hours)}m`
}

/** Workflow duration with optional days: "45m", "3h", "8h 25m", "1d 4h", "2d 6h 30m". */
export function formatWorkflowDurationFromMs(ms) {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60000)
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    const parts = [`${days}d`]
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    return parts.join(' ')
  }
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return '0m'
}

/** Live header timer with days, hours, minutes, and seconds. e.g. "0d 0h 8m 45s". */
export function formatLiveWorkflowDurationFromMs(ms) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${days}d ${hours}h ${minutes}m ${seconds}s`
}

export function formatSessionDuration(session) {
  if (!session) return '—'
  const { loginTime, logoutTime, totalHours, totalPausedMs, taskStatus, autoCheckedOut } = session
  if (totalHours != null && totalHours > 0) {
    return formatDurationFromMs(Math.round(totalHours * 3600000))
  }
  const loginMs = loginTime ? new Date(loginTime).getTime() : 0
  if (!loginMs) return '—'
  
  const isFinalized = logoutTime || autoCheckedOut === true || ['Completed', 'Pending', 'Session Incomplete', 'Session Finished', 'Rejected'].includes(taskStatus);
  
  const logoutMs = isFinalized
    ? (logoutTime ? new Date(logoutTime).getTime() : loginMs)
    : taskStatus === 'In Progress'
      ? Date.now()
      : 0
  if (!logoutMs) return '—'
  return formatDurationFromMs(computeWorkedMs(loginMs, logoutMs, totalPausedMs || 0))
}
