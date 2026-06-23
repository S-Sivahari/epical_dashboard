import { useMemo } from 'react'
import {
  EMPLOYEE_NAV_ITEMS,
  EMPLOYEE_NOTES_NAV_ITEM,
  type EmployeeNavItem,
} from '@constants/employeeNavigation'
import { useEmployeeNotesAccess } from '@hooks/useEmployeeNotesAccess'

export function useEmployeeNavItems(): EmployeeNavItem[] {
  const { showNotesNav } = useEmployeeNotesAccess()

  return useMemo(() => {
    let items = [...EMPLOYEE_NAV_ITEMS]

    if (showNotesNav) {
      const timesheetIndex = items.findIndex((item) => item.to === '/employee/timesheet')
      const insertAt = timesheetIndex >= 0 ? timesheetIndex + 1 : 2
      items.splice(insertAt, 0, EMPLOYEE_NOTES_NAV_ITEM)
    }

    return items
  }, [showNotesNav])
}
