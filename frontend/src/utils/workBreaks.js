export const DAILY_STANDARD_BREAK_MS = 60 * 60 * 1000

export const WORK_BREAK_OPTIONS = [
  { type: 'morning', label: 'Morning', durationMinutes: 15 },
  { type: 'lunch', label: 'Lunch', durationMinutes: 30 },
  { type: 'evening', label: 'Evening', durationMinutes: 15 },
]

export function computeGrossAttendanceMs(checkInTime, checkOutTime, now = Date.now()) {
  const startMs = new Date(checkInTime).getTime()
  const endMs = checkOutTime ? new Date(checkOutTime).getTime() : now
  return Math.max(0, endMs - startMs)
}

export function computeNetAttendanceMs(checkInTime, checkOutTime, now = Date.now()) {
  return Math.max(0, computeGrossAttendanceMs(checkInTime, checkOutTime, now) - DAILY_STANDARD_BREAK_MS)
}

export function formatBreakCountdown(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
