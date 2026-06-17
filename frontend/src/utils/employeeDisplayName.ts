export function buildEmployeeFullName(
  employee: {
    firstName?: string
    middleName?: string
    lastName?: string
  } | null | undefined,
): string {
  if (!employee) return ''
  return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ').trim()
}
