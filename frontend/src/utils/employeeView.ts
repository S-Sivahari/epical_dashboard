import type { Employee } from '@/types'

export type EmployeeView = 'Public' | 'Private'

export const EMPLOYEE_VIEW_DEFAULT: EmployeeView = 'Public'

export function normalizeEmployeeView(value?: string | null): EmployeeView {
  return String(value ?? '').trim() === 'Private' ? 'Private' : 'Public'
}

export function isPublicEmployee(employee?: Pick<Employee, 'view'> | null): boolean {
  return normalizeEmployeeView(employee?.view as string | undefined) === 'Public'
}

export function isPrivateEmployee(employee?: Pick<Employee, 'view'> | null): boolean {
  return !isPublicEmployee(employee)
}

/** Employees eligible for project creation and cell/member allocation. */
export function filterAllocatableEmployees<T extends Pick<Employee, 'view'>>(employees: T[]): T[] {
  return employees.filter((employee) => isPublicEmployee(employee))
}
