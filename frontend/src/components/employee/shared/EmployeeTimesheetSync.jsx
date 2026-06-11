import { useEffect } from 'react'
import { useTimesheetStore } from '@store/employee/timesheetStore'

/** Keeps timesheet attendance state fresh across all employee portal pages. */
export function EmployeeTimesheetSync() {
  const initialized = useTimesheetStore((s) => s.initialized)
  const checkedIn = useTimesheetStore((s) => s.checkedIn)
  const hydrate = useTimesheetStore((s) => s.hydrate)
  const syncAttendanceWithBackend = useTimesheetStore((s) => s.syncAttendanceWithBackend)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!initialized || !checkedIn) return undefined
    const sync = () => void syncAttendanceWithBackend()
    sync()
    const id = setInterval(sync, 30000)
    return () => clearInterval(id)
  }, [initialized, checkedIn, syncAttendanceWithBackend])

  useEffect(() => {
    const onFocus = () => {
      if (useTimesheetStore.getState().initialized) {
        void syncAttendanceWithBackend()
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [syncAttendanceWithBackend])

  return null
}
