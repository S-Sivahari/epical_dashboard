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
    
    // Poll for updates every 5 seconds WITHOUT loading indicator
    const interval = setInterval(() => {
      void fetchEmployeesSilent()
    }, 5000)
    
    return () => clearInterval(interval)
  }, [
    fetchEmployees,
    fetchEmployeesSilent,
    filters.name,
    filters.employeeId,
    filters.department,
    filters.employmentType,
    filters.employmentStatus,
    filters.status,
    pagination.page,
    pagination.pageSize,
    sort.column,
    sort.direction,
  ])
  
  return useEmployeeStore()
}
