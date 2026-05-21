import { useEffect } from 'react'
import { useLeaveStore } from '@store/leaveStore'

export function useLeaves() {
  const fetchLeaves = useLeaveStore((s) => s.fetchLeaves)
  const fetchLeavesSilent = useLeaveStore((s) => s.fetchLeavesSilent)
  const fetchHolidays = useLeaveStore((s) => s.fetchHolidays)
  const fetchHolidaysSilent = useLeaveStore((s) => s.fetchHolidaysSilent)
  
  useEffect(() => {
    // Initial fetch with loading indicator
    void fetchLeaves()
    void fetchHolidays()
    
    // Poll for updates every 5 seconds WITHOUT loading indicator
    const leaveInterval = setInterval(() => {
      void fetchLeavesSilent()
    }, 5000)
    
    const holidayInterval = setInterval(() => {
      void fetchHolidaysSilent()
    }, 5000)
    
    return () => {
      clearInterval(leaveInterval)
      clearInterval(holidayInterval)
    }
  }, [fetchLeaves, fetchLeavesSilent, fetchHolidays, fetchHolidaysSilent])
  
  return useLeaveStore()
}
