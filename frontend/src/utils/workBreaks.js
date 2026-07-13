export const DAILY_STANDARD_BREAK_MINUTES = 50

export const DAILY_STANDARD_BREAK_MS = DAILY_STANDARD_BREAK_MINUTES * 60 * 1000

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

/** Attendance charts: gross check-in to check-out (before daily break allowance). */
export function computeGrossAttendanceMs(checkInTime, checkOutTime, now = Date.now()) {
  const start = new Date(checkInTime).getTime()
  const end = checkOutTime ? new Date(checkOutTime).getTime() : now
  return Math.max(0, end - start)
}

/** One 50-minute daily break allowance (morning + lunch + evening) per calendar day. */
export function applyDailyStandardBreakDeductionMs(grossMs) {
  const safeGross = Math.max(0, Number(grossMs) || 0)
  if (safeGross <= 0) return 0
  return Math.max(0, safeGross - DAILY_STANDARD_BREAK_MS)
}

export function segmentGrossAttendanceMs(seg, checkedIn, liveNow) {
  const isOpen = checkedIn && !seg.checkOutTime
  if (seg.checkInTime) {
    return computeGrossAttendanceMs(
      seg.checkInTime,
      seg.checkOutTime,
      isOpen ? liveNow : undefined,
    )
  }
  if (typeof seg.hours === 'number') {
    return Math.max(0, seg.hours * 3600000)
  }
  return 0
}

/**
 * Sum attendance for a day, subtract 50m break once, then allocate net time across segments.
 */
export function segmentNetAttendanceMs(seg, grossByDate, checkedIn, liveNow) {
  const grossMs = segmentGrossAttendanceMs(seg, checkedIn, liveNow)
  const dayGross = grossByDate?.[seg.date] ?? grossMs
  const dayNet = applyDailyStandardBreakDeductionMs(dayGross)
  if (dayGross <= 0 || grossMs <= 0) return 0
  return Math.floor((grossMs / dayGross) * dayNet)
}

export function buildGrossAttendanceByDate(attendanceHistory, checkedIn, liveNow, { inRange } = {}) {
  const grossByDate = {}
  for (const seg of attendanceHistory) {
    if (inRange && !inRange(seg.date)) continue
    grossByDate[seg.date] = (grossByDate[seg.date] || 0) + segmentGrossAttendanceMs(seg, checkedIn, liveNow)
  }
  return grossByDate
}

/** Single-segment net attendance: gross check-in to check-out minus one 50m daily break. */
export function computeNetAttendanceMs(checkInTime, checkOutTime, nowOrOptions) {
  let now
  if (typeof nowOrOptions === 'number') {
    now = nowOrOptions
  } else if (nowOrOptions && typeof nowOrOptions === 'object') {
    now = nowOrOptions.now
  }
  const end = checkOutTime ? new Date(checkOutTime).getTime() : (now ?? Date.now())
  const grossMs = computeGrossAttendanceMs(checkInTime, checkOutTime, end)
  return applyDailyStandardBreakDeductionMs(grossMs)
}
