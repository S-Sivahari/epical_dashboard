import { useEffect } from 'react'
import { useTimesheetStore } from '@store/employee/timesheetStore'

/** Keeps timesheet attendance state fresh across all employee portal pages. */
export function EmployeeTimesheetSync() {
  const initialized = useTimesheetStore((s) => s.initialized)
  const checkedIn = useTimesheetStore((s) => s.checkedIn)
  const attendance = useTimesheetStore((s) => s.attendance)
  const serverTimeSkew = useTimesheetStore((s) => s.serverTimeSkew)
  const hydrate = useTimesheetStore((s) => s.hydrate)
  const syncAttendanceWithBackend = useTimesheetStore((s) => s.syncAttendanceWithBackend)
  const endBreak = useTimesheetStore((s) => s.endBreak)

  const activeBreak = attendance?.breaks?.activeBreak ?? null

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

  useEffect(() => {
    if (!checkedIn || !activeBreak?.endsAt) return undefined

    const minEndsAt = activeBreak.minEndsAt ? new Date(activeBreak.minEndsAt).getTime() : 0
    const canEnd = activeBreak.canEnd ?? (minEndsAt <= 0 || Date.now() + (serverTimeSkew || 0) >= minEndsAt)
    if (!canEnd) return undefined

    const endsAt = new Date(activeBreak.endsAt).getTime()
    const now = () => Date.now() + (serverTimeSkew || 0)

    if (now() >= endsAt) {
      void endBreak().catch(() => {})
      return undefined
    }

    const id = window.setInterval(() => {
      if (now() >= endsAt) void endBreak().catch(() => {})
    }, 1000)

    return () => window.clearInterval(id)
  }, [checkedIn, activeBreak, serverTimeSkew, endBreak])

  return null
}
