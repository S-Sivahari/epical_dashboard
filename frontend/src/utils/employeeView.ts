import type { Employee } from '@/types'

export type EmployeeView = 'Public' | 'Private'

export const EMPLOYEE_VIEW_DEFAULT: EmployeeView = 'Public'

export function normalizeEmployeeView(value?: string | null): EmployeeView {
  return String(value ?? '').trim() === 'Private' ? 'Private' : 'Public'
}

export function isPublicEmployee(employee?: Pick<Employee, 'view'> | null): boolean {
  return normalizeEmployeeView(employee?.view as string | undefined) === 'Public'
}

export function filterPublicEmployees<T extends Pick<Employee, 'view'>>(employees: T[]): T[] {
  return employees.filter((employee) => isPublicEmployee(employee))
}

/** Routes hidden for private-view employees (payroll-only visibility). */
export const PRIVATE_EMPLOYEE_HIDDEN_ROUTES = [
  '/employee/timesheet',
  '/employee/leave',
  '/employee/calendar',
  '/employee/notes',
] as const

export function isPrivateEmployeeRoute(pathname: string): boolean {
  return PRIVATE_EMPLOYEE_HIDDEN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )
}
