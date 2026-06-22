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

const BREAK_DURATION_MS = {
  morning: 10 * 60 * 1000,
  lunch: 30 * 60 * 1000,
  evening: 10 * 60 * 1000,
}

export function computeUsedBreakMs(breaks) {
  if (!breaks) return 0
  let total = 0
  if (breaks.morning?.used) total += BREAK_DURATION_MS.morning
  if (breaks.lunch?.used) total += BREAK_DURATION_MS.lunch
  if (breaks.evening?.used) total += BREAK_DURATION_MS.evening
  return total
}

export function computeNetAttendanceMs(checkInTime, checkOutTime, nowOrOptions) {
  let now
  let breaks
  if (typeof nowOrOptions === 'number') {
    now = nowOrOptions
  } else if (nowOrOptions && typeof nowOrOptions === 'object') {
    now = nowOrOptions.now
    breaks = nowOrOptions.breaks
  }
  const start = new Date(checkInTime).getTime()
  const end = checkOutTime ? new Date(checkOutTime).getTime() : (now ?? Date.now())
  const gross = Math.max(0, end - start)
  const usedBreakMs = computeUsedBreakMs(breaks)
  const deduction = usedBreakMs > 0 ? usedBreakMs : DAILY_STANDARD_BREAK_MINUTES * 60 * 1000
  return Math.max(0, gross - deduction)
}
