import { useMemo } from 'react'
import {
  EMPLOYEE_NAV_ITEMS,
  EMPLOYEE_NOTES_NAV_ITEM,
  type EmployeeNavItem,
} from '@constants/employeeNavigation'
import { useEmployeeNotesAccess } from '@hooks/useEmployeeNotesAccess'
import { useEmployeePortalView } from '@hooks/useEmployeePortalView'
import { PRIVATE_EMPLOYEE_HIDDEN_ROUTES } from '@/utils/employeeView'

export function useEmployeeNavItems(): EmployeeNavItem[] {
  const { showNotesNav } = useEmployeeNotesAccess()
  const { isPrivate } = useEmployeePortalView()

  return useMemo(() => {
    const hiddenRoutes = new Set<string>(
      isPrivate ? [...PRIVATE_EMPLOYEE_HIDDEN_ROUTES] : [],
    )

    let items = EMPLOYEE_NAV_ITEMS.filter((item) => !hiddenRoutes.has(item.to))

    if (showNotesNav && !hiddenRoutes.has(EMPLOYEE_NOTES_NAV_ITEM.to)) {
      items = [...items]
      const timesheetIndex = items.findIndex((item) => item.to === '/employee/timesheet')
      const insertAt = timesheetIndex >= 0 ? timesheetIndex + 1 : 2
      items.splice(insertAt, 0, EMPLOYEE_NOTES_NAV_ITEM)
    }

    return items
  }, [isPrivate, showNotesNav])
}
