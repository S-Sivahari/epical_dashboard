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

function namePartCount(name: string): number {
  return name.trim().split(/\s+/).filter(Boolean).length
}

/** Prefer structured profile name; keep auth/display name when it has more parts (e.g. middle name). */
export function resolveEmployeeDisplayName(
  employee?: {
    firstName?: string
    middleName?: string
    lastName?: string
    name?: string
  } | null,
  fallbackName?: string,
): string {
  const structured = buildEmployeeFullName(employee)
  const fallback = (fallbackName ?? employee?.name ?? '').trim()

  if (!structured) {
    return fallback || getEmployeeFirstName(employee, fallback) || 'Employee'
  }
  if (!fallback) return structured

  if (namePartCount(fallback) > namePartCount(structured)) return fallback
  return structured
}

/** Greeting / banner label — first name only. */
export function getEmployeeFirstName(
  employee?: { firstName?: string } | null,
  fallbackName?: string,
): string {
  const fromProfile = employee?.firstName?.trim()
  if (fromProfile) return fromProfile
  const token = (fallbackName ?? '').trim().split(/\s+/).find(Boolean)
  return token ?? ''
}

type AssigneeEmployee = {
  id: string
  employeeId?: string
  firstName?: string
  middleName?: string
  lastName?: string
}

/** Match a cell assignee token against either internal id or business employeeId. */
export function findEmployeeByAssigneeId(
  employees: AssigneeEmployee[],
  assigneeId?: string | null,
): AssigneeEmployee | undefined {
  const token = String(assigneeId ?? '').trim()
  if (!token) return undefined
  const upper = token.toUpperCase()
  return employees.find(
    (employee) =>
      employee.id === token
      || employee.employeeId === token
      || (employee.employeeId && employee.employeeId.toUpperCase() === upper),
  )
}

/** Resolve the value used by assignee <select> controls. */
export function resolveAssigneeSelectValue(
  employees: AssigneeEmployee[],
  assigneeId?: string | null,
): string {
  return findEmployeeByAssigneeId(employees, assigneeId)?.id ?? ''
}

export function normalizeCellAssigneeFields<T extends {
  assignedEmployeeId?: string
  assignedEmployeeName?: string
}>(
  cell: T,
  employees: AssigneeEmployee[],
): T {
  const employee = findEmployeeByAssigneeId(employees, cell.assignedEmployeeId)
  if (!employee) return cell
  return {
    ...cell,
    assignedEmployeeId: employee.id,
    assignedEmployeeName: buildEmployeeFullName(employee) || cell.assignedEmployeeName,
  }
}
