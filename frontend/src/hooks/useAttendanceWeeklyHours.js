import { useEffect, useMemo, useState } from 'react'
import { useTimesheetStore } from '@store/employee/timesheetStore'
import { getWeekRange } from '@pages/employee/lib/dateFilters'
import {
  buildWeeklyHoursChartData,
  todayHoursFromChart,
  totalWeeklyHoursFromChart,
} from '@utils/attendanceWeeklyHours'

export function useAttendanceWeeklyHours() {
  const { sessions, initialized, hydrate } = useTimesheetStore()

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const weekRange = useMemo(() => getWeekRange(), [])

  const weeklyHours = useMemo(
    () => buildWeeklyHoursChartData(sessions, { weekRange }),
    [sessions, weekRange],
  )

  return {
    weeklyHours,
    totalWeekly: totalWeeklyHoursFromChart(weeklyHours),
    todayHours: todayHoursFromChart(weeklyHours),
    chartLoading: !initialized,
    weekRange,
  }
}
