import { useEffect } from 'react'
import { useEmployeeStore } from '@store/employeeStore'

export function useEmployees() {
  const filters = useEmployeeStore((s) => s.filters)
  const pagination = useEmployeeStore((s) => s.pagination)
  const fetchEmployees = useEmployeeStore((s) => s.fetchEmployees)
  useEffect(() => {
    void fetchEmployees()
  }, [
    fetchEmployees,
    filters.name,
    filters.employeeId,
    filters.department,
    filters.employmentType,
    filters.status,
    pagination.page,
    pagination.pageSize,
  ])
  return useEmployeeStore()
}
