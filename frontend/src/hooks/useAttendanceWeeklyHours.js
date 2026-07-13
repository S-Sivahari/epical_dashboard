import { useEffect, useMemo, useState } from 'react'
import { useTimesheetStore } from '@store/employee/timesheetStore'
import { getWeekRange } from '@pages/employee/lib/dateFilters'
import {
  buildWeeklyHoursChartData,
  todayMsFromChart,
  totalWeeklyMsFromChart,
} from '@utils/attendanceWeeklyHours'

export function useAttendanceWeeklyHours() {
  const {
    sessions,
    attendanceHistory,
    checkedIn,
    activeTask,
    pausedTasks,
    serverTimeSkew,
    initialized,
    hydrate,
  } = useTimesheetStore()

  const [liveNow, setLiveNow] = useState(() => Date.now() + (serverTimeSkew || 0))

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    setLiveNow(Date.now() + (serverTimeSkew || 0))
  }, [serverTimeSkew])

  useEffect(() => {
    if (!checkedIn) return undefined
    const tick = () => setLiveNow(Date.now() + (serverTimeSkew || 0))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [checkedIn, serverTimeSkew])

  const weekRange = useMemo(() => getWeekRange(new Date(liveNow)), [liveNow])

  const weeklyHours = useMemo(
    () =>
      buildWeeklyHoursChartData(sessions, {
        weekRange,
        attendanceHistory,
        checkedIn,
        liveNow,
        activeTask,
        pausedTasks,
      }),
    [sessions, weekRange, attendanceHistory, checkedIn, liveNow, activeTask, pausedTasks],
  )

  return {
    weeklyHours,
    totalWeeklyMs: totalWeeklyMsFromChart(weeklyHours),
    todayMs: todayMsFromChart(weeklyHours),
    totalWeekly: totalWeeklyMsFromChart(weeklyHours) / 3600000,
    todayHours: todayMsFromChart(weeklyHours) / 3600000,
    chartLoading: !initialized,
    weekRange,
  }
}
