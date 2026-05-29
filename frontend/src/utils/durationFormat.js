/**
 * Shared duration helpers for timesheet UI.
 */

export function computeWorkedMs(loginTime, logoutTime, totalPausedMs = 0) {
  const start = loginTime instanceof Date ? loginTime.getTime() : new Date(loginTime).getTime()
  const end = logoutTime instanceof Date ? logoutTime.getTime() : new Date(logoutTime).getTime()
  const paused = totalPausedMs || 0
  return Math.max(0, end - start - paused)
}

export function formatDurationFromMs(ms, padMinutes = false) {
  const safeMs = Math.max(0, Math.floor(ms))
  const totalMinutes = Math.floor(safeMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0 && minutes === 0) return '0m'
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  const minPart = padMinutes ? String(minutes).padStart(2, '0') : String(minutes)
  return `${hours}h ${minPart}m`
}

export function formatSessionDuration(session) {
  if (!session) return '—'
  const { loginTime, logoutTime, totalHours, totalPausedMs, taskStatus } = session
  if (totalHours != null && totalHours > 0) {
    return formatDurationFromMs(Math.round(totalHours * 3600000))
  }
  const loginMs = loginTime ? new Date(loginTime).getTime() : 0
  if (!loginMs) return '—'
  const logoutMs = logoutTime
    ? new Date(logoutTime).getTime()
    : taskStatus === 'In Progress'
      ? Date.now()
      : 0
  if (!logoutMs) return '—'
  return formatDurationFromMs(computeWorkedMs(loginMs, logoutMs, totalPausedMs || 0))
}
