import { EMPLOYEE_NAV_ITEMS, type EmployeeNavItem } from '@constants/employeeNavigation'

export function useEmployeeNavItems(): EmployeeNavItem[] {
  return EMPLOYEE_NAV_ITEMS
}
