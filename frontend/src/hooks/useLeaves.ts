import { useEffect } from 'react'
import { useLeaveStore } from '@store/leaveStore'

const LEAVES_POLL_MS = 60_000

export function useLeaves() {
  const fetchLeaves = useLeaveStore((s) => s.fetchLeaves)
  const fetchLeavesSilent = useLeaveStore((s) => s.fetchLeavesSilent)
  const fetchHolidays = useLeaveStore((s) => s.fetchHolidays)
  const fetchHolidaysSilent = useLeaveStore((s) => s.fetchHolidaysSilent)
  
  useEffect(() => {
    void fetchLeaves()
    void fetchHolidays()
    
    const leaveInterval = setInterval(() => {
      void fetchLeavesSilent()
    }, LEAVES_POLL_MS)
    
    const holidayInterval = setInterval(() => {
      void fetchHolidaysSilent()
    }, LEAVES_POLL_MS)
    
    return () => {
      clearInterval(leaveInterval)
      clearInterval(holidayInterval)
    }
  }, [fetchLeaves, fetchLeavesSilent, fetchHolidays, fetchHolidaysSilent])
  return useLeaveStore()
}
