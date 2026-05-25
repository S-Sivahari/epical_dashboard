import { useEffect } from 'react'
import { useEmployeeStore } from '@store/employeeStore'

export function useEmployees() {
  const filters = useEmployeeStore((s) => s.filters)
  const pagination = useEmployeeStore((s) => s.pagination)
  const fetchEmployees = useEmployeeStore((s) => s.fetchEmployees)
  const fetchEmployeesSilent = useEmployeeStore((s) => s.fetchEmployeesSilent)
  const sort = useEmployeeStore((s) => s.sort)
  
  useEffect(() => {
    // Initial fetch with loading indicator
    void fetchEmployees()
    
    // Poll for updates every 10 seconds (smart polling with cache validation)
    const interval = setInterval(() => {
      void fetchEmployeesSilent()
    }, 10000)
    
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
