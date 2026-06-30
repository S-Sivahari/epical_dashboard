export const DAILY_STANDARD_BREAK_MINUTES = 50

export const WORK_BREAK_OPTIONS = [
  { type: 'morning', label: 'Morning', durationMinutes: 10, minDurationMinutes: 5 },
  { type: 'lunch', label: 'Lunch', durationMinutes: 30, minDurationMinutes: 15 },
  { type: 'evening', label: 'Evening', durationMinutes: 10, minDurationMinutes: 5 },
]

export function formatBreakCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** Attendance charts: gross check-in to check-out (breaks affect project hours only). */
export function computeGrossAttendanceMs(checkInTime, checkOutTime, now = Date.now()) {
  const start = new Date(checkInTime).getTime()
  const end = checkOutTime ? new Date(checkOutTime).getTime() : now
  return Math.max(0, end - start)
}

/** @deprecated Use computeGrossAttendanceMs — breaks no longer reduce attendance display time. */
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
