import { getWeekRange, isDateInRange } from '@pages/employee/lib/dateFilters'
import { resolveDisplayWorkedMs } from '@utils/durationFormat'
import { computeEmployeeLiveSessionMs } from '@utils/workBreaks'

const CHART_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function getDayKey(date) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]
}

export function resolveTaskPauseState(activeTask, pausedTasks, liveNow) {
  const currentTask = activeTask || pausedTasks?.[0] || null
  if (!currentTask) {
    return { taskPausedMs: 0, taskCurrentlyPaused: false }
  }

  let taskPausedMs = currentTask.totalPausedMs || 0
  const taskCurrentlyPaused = !activeTask && Boolean(currentTask.pausedAt)
  if (taskCurrentlyPaused && currentTask.pausedAt) {
    taskPausedMs += Math.max(0, liveNow - new Date(currentTask.pausedAt).getTime())
  }

  return { taskPausedMs, taskCurrentlyPaused }
}

function resolveAttendanceSegmentMs(seg, options) {
  const { checkedIn, liveNow, taskPausedMs = 0, taskCurrentlyPaused = false } = options
  const isOpen = checkedIn && !seg.checkOutTime

  if (isOpen && seg.checkInTime) {
    return computeEmployeeLiveSessionMs(
      seg.checkInTime,
      taskPausedMs,
      taskCurrentlyPaused,
      liveNow,
    )
  }

  return resolveDisplayWorkedMs({
    sessionWorkedMs: seg.sessionWorkedMs,
    hours: seg.hours,
    loginTime: seg.checkInTime,
    logoutTime: seg.checkOutTime,
  })
}

/**
 * Build Mon–Sun chart rows for the current week (ms is source of truth).
 */
export function buildWeeklyHoursChartData(
  sessions,
  {
    weekRange,
    attendanceHistory,
    checkedIn = false,
    liveNow,
    activeTask = null,
    pausedTasks = [],
  } = {},
) {
  const range = weekRange ?? getWeekRange()
  const byDayMs = {}
  const now = liveNow ?? Date.now()
  const attendanceDates = new Set()
  const { taskPausedMs, taskCurrentlyPaused } = resolveTaskPauseState(
    activeTask,
    pausedTasks,
    now,
  )

  const segmentOptions = {
    checkedIn,
    liveNow: now,
    taskPausedMs,
    taskCurrentlyPaused,
  }

  ;(attendanceHistory ?? []).forEach((seg) => {
    if (!seg?.date || !isDateInRange(seg.date, range.start, range.end)) return
    attendanceDates.add(seg.date)
    const key = getDayKey(new Date(`${seg.date}T12:00:00`))
    byDayMs[key] = (byDayMs[key] || 0) + resolveAttendanceSegmentMs(seg, segmentOptions)
  })

  ;(sessions ?? []).forEach((session) => {
    if (!session?.date || !isDateInRange(session.date, range.start, range.end)) return
    if (attendanceDates.has(session.date)) return

    const workedMs = resolveDisplayWorkedMs(session)
    if (workedMs <= 0) return

    const key = getDayKey(new Date(`${session.date}T12:00:00`))
    byDayMs[key] = (byDayMs[key] || 0) + workedMs
  })

  return CHART_DAYS.map((day) => {
    const workedMs = byDayMs[day] || 0
    return {
      day,
      workedMs,
      hours: workedMs / 3600000,
      target: 8,
    }
  })
}

export function todayMsFromChart(weeklyHours, date = new Date()) {
  const todayKey = getDayKey(date)
  return weeklyHours.find((row) => row.day === todayKey)?.workedMs ?? 0
}

export function totalWeeklyMsFromChart(weeklyHours) {
  return weeklyHours.reduce((sum, row) => sum + (row.workedMs || 0), 0)
}

/** @deprecated Use todayMsFromChart + formatWorkedDuration */
export function todayHoursFromChart(weeklyHours, date = new Date()) {
  return todayMsFromChart(weeklyHours, date) / 3600000
}

/** @deprecated Use totalWeeklyMsFromChart + formatWorkedDuration */
export function totalWeeklyHoursFromChart(weeklyHours) {
  return totalWeeklyMsFromChart(weeklyHours) / 3600000
}
