import { formatDurationFromMs } from './durationFormat'

export const DAILY_STANDARD_BREAK_MINUTES = 50

export const WORK_BREAK_OPTIONS = [
  { type: 'morning', label: 'Morning', durationMinutes: 10, minDurationMinutes: 5 },
  { type: 'lunch', label: 'Lunch', durationMinutes: 30, minDurationMinutes: 15 },
  { type: 'evening', label: 'Evening', durationMinutes: 10, minDurationMinutes: 5 },
]

const BREAK_DURATION_MS = {
  morning: 10 * 60 * 1000,
  lunch: 30 * 60 * 1000,
  evening: 10 * 60 * 1000,
}

export function formatBreakCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function computeGrossAttendanceMs(checkInTime, checkOutTime, now = Date.now()) {
  const start = new Date(checkInTime).getTime()
  const end = checkOutTime ? new Date(checkOutTime).getTime() : now
  return Math.max(0, end - start)
}

/** Sum completed + in-progress break time from the attendance breaks payload. */
export function computeUsedBreakMsFromPayload(breaks, now = Date.now()) {
  if (!breaks) return 0

  let total = 0
  const activeType = breaks.activeBreak?.type

  for (const type of ['morning', 'lunch', 'evening']) {
    const slot = breaks[type]
    if (!slot?.used) continue
    if (activeType === type) continue

    if (typeof slot.actualMs === 'number' && slot.actualMs >= 0) {
      total += slot.actualMs
    } else {
      total += BREAK_DURATION_MS[type] ?? 0
    }
  }

  const activeBreak = breaks.activeBreak
  if (activeBreak?.startedAt) {
    const elapsed = now - new Date(activeBreak.startedAt).getTime()
    const maxMs = BREAK_DURATION_MS[activeBreak.type] ?? 0
    total += Math.min(Math.max(0, elapsed), maxMs)
  }

  return total
}

/** Total break ms taken today (completed slots + active break). */
export function getBreakTimeTodayMs(breaks, now = Date.now()) {
  return computeUsedBreakMsFromPayload(breaks, now)
}

/** Human-readable break time today, e.g. "25m" or "1h 05m". */
export function formatBreakTimeToday(breaks, now = Date.now()) {
  return formatDurationFromMs(getBreakTimeTodayMs(breaks, now))
}

/** Employee-facing live session ms (matches command bar: check-in elapsed minus task pauses). */
export function computeEmployeeLiveSessionMs(
  checkInTime,
  taskPausedMs = 0,
  taskCurrentlyPaused = false,
  now = Date.now(),
) {
  return computeLiveWorkingMs(checkInTime, null, taskPausedMs, taskCurrentlyPaused, now)
}

/** Net working ms for a live attendance session (gross minus optional breaks and task pauses). */
export function computeLiveWorkingMs(
  checkInTime,
  breaks,
  taskPausedMs = 0,
  taskCurrentlyPaused = false,
  now = Date.now(),
) {
  const grossMs = computeGrossAttendanceMs(checkInTime, null, now)
  const breakMs = taskCurrentlyPaused ? 0 : computeUsedBreakMsFromPayload(breaks, now)
  return Math.max(0, grossMs - (taskPausedMs || 0) - breakMs)
}

/** @deprecated Use computeLiveWorkingMs for employee-facing work time. */
export function computeNetAttendanceMs(checkInTime, checkOutTime, nowOrOptions) {
  let now
  if (typeof nowOrOptions === 'number') {
    now = nowOrOptions
  } else if (nowOrOptions && typeof nowOrOptions === 'object') {
    now = nowOrOptions.now
  }
  const end = checkOutTime ? new Date(checkOutTime).getTime() : (now ?? Date.now())
  return computeGrossAttendanceMs(checkInTime, checkOutTime, end)
}
