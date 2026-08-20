/**
 * Shared duration helpers for timesheet UI.
 */

export function computeWorkedMs(loginTime, logoutTime, totalPausedMs = 0) {
  const start = loginTime instanceof Date ? loginTime.getTime() : new Date(loginTime).getTime()
  const end = logoutTime instanceof Date ? logoutTime.getTime() : new Date(logoutTime).getTime()
  const paused = totalPausedMs || 0
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.max(0, end - start - paused)
}

/** Canonical worked ms for display (prefer persisted checkout values). */
export function resolveDisplayWorkedMs(entry = {}) {
  const {
    workedMs,
    overriddenHours,
    totalHours,
    loginTime,
    logoutTime,
    checkOutTime,
    totalPausedMs,
    sessionWorkedMs,
    hours,
  } = entry

  const completed = Boolean(logoutTime || checkOutTime)

  if (overriddenHours != null && Number.isFinite(Number(overriddenHours))) {
    return Math.max(0, Math.round(Number(overriddenHours) * 3600000))
  }

  if (completed) {
    if (typeof sessionWorkedMs === 'number' && sessionWorkedMs >= 0) {
      return sessionWorkedMs
    }
    if (typeof workedMs === 'number' && workedMs >= 0) {
      return workedMs
    }
    if (totalHours != null && Number.isFinite(Number(totalHours))) {
      return Math.max(0, Math.round(Number(totalHours) * 3600000))
    }
    if (hours != null && Number.isFinite(Number(hours))) {
      return Math.max(0, Math.round(Number(hours) * 3600000))
    }
    return 0
  }

  if (typeof sessionWorkedMs === 'number' && sessionWorkedMs > 0) {
    return sessionWorkedMs
  }
  if (typeof workedMs === 'number' && workedMs > 0) {
    return workedMs
  }
  if (loginTime && logoutTime) {
    return computeWorkedMs(loginTime, logoutTime, totalPausedMs || 0)
  }
  if (totalHours != null && Number.isFinite(Number(totalHours)) && logoutTime) {
    return Math.max(0, Math.round(Number(totalHours) * 3600000))
  }
  if (hours != null && Number.isFinite(Number(hours)) && logoutTime) {
    return Math.max(0, Math.round(Number(hours) * 3600000))
  }
  return 0
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

/** Format any worked-ms value as a duration label. */
export function formatWorkedDuration(input) {
  const ms = typeof input === 'number' ? input : resolveDisplayWorkedMs(input)
  return formatDurationFromMs(ms)
}

/** Decimal hours → duration label (rounds to nearest minute). */
export function formatHoursDecimalAsDuration(hours) {
  const safeHours = Math.max(0, Number(hours) || 0)
  return formatDurationFromMs(Math.round(safeHours * 3600000))
}

/** Alias used by dashboard/analytics charts (decimal hours → "Xh YYm"). */
export const formatHoursAsDuration = formatHoursDecimalAsDuration

/**
 * Compact Y-axis tick label from decimal hours.
 * e.g. 0 → "0", 0.5 → "30m", 2 → "2h", 2.25 → "2h 15m"
 */
export function formatChartAxisMinutesFromHours(hours) {
  const totalMinutes = Math.round(Math.max(0, Number(hours) || 0) * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60

  if (h === 0 && m === 0) return '0'
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** Decimal hours → "6hrs, 48 minutes" (admin dashboard chart labels). */
export function formatHoursDecimalAsLongDuration(hours) {
  const totalMinutes = Math.round(Math.max(0, Number(hours) || 0) * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60

  if (h === 0 && m === 0) return '0 minutes'
  if (h === 0) return `${m} minute${m === 1 ? '' : 's'}`
  if (m === 0) return `${h}hr${h === 1 ? '' : 's'}`
  return `${h}hr${h === 1 ? '' : 's'}, ${m} minute${m === 1 ? '' : 's'}`
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

/** Break duration for timesheets; note default fill when unused slots were applied. */
export function formatBreakDisplayLabel(ms, { isDefault = false, actualMs = 0 } = {}) {
  if (!ms || ms <= 0) return '—'
  if (isDefault && actualMs > 0) {
    return formatDurationFromMs(actualMs)
  }
  const duration = formatDurationFromMs(ms)
  return isDefault ? `${duration} (default)` : duration
}

export function isDefaultBreakDeduction({ breakMs = 0, defaultBreakDeductedMs = 0, displayBreakMs = 0 } = {}) {
  return defaultBreakDeductedMs > 0 && displayBreakMs > 0
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

  const { logoutTime, taskStatus, autoCheckedOut, pausedAt, totalPausedMs } = session
  const completed = Boolean(logoutTime || autoCheckedOut)

  if (completed) {
    return formatWorkedDuration(session)
  }

  const loginMs = session.loginTime ? new Date(session.loginTime).getTime() : 0
  if (!loginMs) return '—'

  const isLive = !logoutTime && (taskStatus === 'In Progress' || taskStatus === 'Paused')
  if (isLive) {
    let paused = totalPausedMs || 0
    if (taskStatus === 'Paused' && pausedAt) {
      paused += Math.max(0, Date.now() - new Date(pausedAt).getTime())
    }
    return formatDurationFromMs(computeWorkedMs(loginMs, Date.now(), paused))
  }

  return '—'
}
