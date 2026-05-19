import { useEffect } from 'react'
import { useLeaveStore } from '@store/leaveStore'

export function useLeaves() {
  const fetchLeaves = useLeaveStore((s) => s.fetchLeaves)
  const fetchHolidays = useLeaveStore((s) => s.fetchHolidays)
  useEffect(() => {
    void fetchLeaves()
    void fetchHolidays()
  }, [fetchLeaves, fetchHolidays])
  return useLeaveStore()
}
