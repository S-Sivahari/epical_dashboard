import { useEffect, useState } from 'react'
import { getMyEmployee } from '@services/employeeService'
import {
  EMPLOYEE_VIEW_DEFAULT,
  normalizeEmployeeView,
  type EmployeeView,
} from '@/utils/employeeView'

export function useEmployeePortalView() {
  const [view, setView] = useState<EmployeeView>(EMPLOYEE_VIEW_DEFAULT)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    void getMyEmployee()
      .then((employee) => {
        if (!cancelled) {
          setView(normalizeEmployeeView(employee.view as string | undefined))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setView(EMPLOYEE_VIEW_DEFAULT)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return {
    view,
    loading,
    isPrivate: view === 'Private',
    isPublic: view === 'Public',
  }
}
