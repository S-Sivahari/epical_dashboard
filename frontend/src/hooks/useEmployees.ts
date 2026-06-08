import { useEffect } from 'react'
import { useEmployeeStore } from '@store/employeeStore'

const POLL_INTERVAL_MS = 60_000

export function useEmployees() {
  const filters = useEmployeeStore((s) => s.filters)
  const pagination = useEmployeeStore((s) => s.pagination)
  const fetchEmployees = useEmployeeStore((s) => s.fetchEmployees)
  const fetchEmployeesSilent = useEmployeeStore((s) => s.fetchEmployeesSilent)
  const sort = useEmployeeStore((s) => s.sort)

  useEffect(() => {
    void fetchEmployees()

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchEmployeesSilent()
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [
    fetchEmployees,
    fetchEmployeesSilent,
    filters.name,
    filters.employmentType,
    filters.status,
    pagination.page,
    pagination.pageSize,
    sort.column,
    sort.direction,
  ])

  return useEmployeeStore()
}
