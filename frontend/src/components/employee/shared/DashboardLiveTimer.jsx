import { useEffect } from 'react'
import { LiveSessionTimer } from '@pages/employee/TimesheetLiveSessionPanel'
import { useTimesheetStore } from '@store/employee/timesheetStore'
import { cn } from '@pages/employee/lib/utils'

/** Checked-in session time only — empty when not checked in. */
export function DashboardLiveTimer({ className }) {
  const initialized = useTimesheetStore((s) => s.initialized)
  const checkedIn = useTimesheetStore((s) => s.checkedIn)
  const checkInTime = useTimesheetStore((s) => s.checkInTime)
  const activeTask = useTimesheetStore((s) => s.activeTask)
  const pausedTasks = useTimesheetStore((s) => s.pausedTasks)
  const serverTimeSkew = useTimesheetStore((s) => s.serverTimeSkew)
  const backendElapsedMs = useTimesheetStore((s) => s.backendElapsedMs)
  const backendElapsedLastFetch = useTimesheetStore((s) => s.backendElapsedLastFetch)
  const attendance = useTimesheetStore((s) => s.attendance)
  const hydrate = useTimesheetStore((s) => s.hydrate)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  if (!initialized || !checkedIn || !checkInTime) {
    return null
  }

  const resolvedCheckIn =
    checkInTime instanceof Date ? checkInTime : new Date(checkInTime)

  if (Number.isNaN(resolvedCheckIn.getTime())) {
    return null
  }

  return (
    <div className={cn('emp-dash-live-timer', className)} aria-live="polite">
      <LiveSessionTimer
        checkInTime={resolvedCheckIn}
        activeTask={activeTask}
        pausedTasks={pausedTasks}
        serverTimeSkew={serverTimeSkew}
        backendElapsedMs={backendElapsedMs}
        backendElapsedLastFetch={backendElapsedLastFetch}
        breaks={attendance?.breaks}
        inline
      />
    </div>
  )
}
