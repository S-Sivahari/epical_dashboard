import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'
import type { DocumentRequestRecord, LeaveRequest } from '@/types'
import type { PendingApprovalTask } from './dashboardRightWorkspaceData'

function safeParseDate(value?: string): Date | null {
  if (!value) return null
  try {
    return startOfDay(typeof value === 'string' ? parseISO(value) : new Date(value))
  } catch {
    return null
  }
}

export function formatRequestedAgo(value?: string): string {
  const date = safeParseDate(value)
  if (!date) return 'Recently'
  const days = differenceInCalendarDays(new Date(), date)
  if (days <= 0) return ''
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 14) return '1w ago'
  return format(date, 'MMM d')
}

function employeeJoinDate(emp: Record<string, unknown>): Date | null {
  const dateStr =
    (typeof emp.joinedAt === 'string' && emp.joinedAt) ||
    (typeof emp.joinDate === 'string' && emp.joinDate) ||
    (typeof emp.dateOfJoining === 'string' && emp.dateOfJoining) ||
    undefined
  if (dateStr) return safeParseDate(dateStr)

  const created = emp.createdAt
  if (typeof created === 'string') return safeParseDate(created)
  if (created instanceof Date) return safeParseDate(created.toISOString())
  return null
}

export function countEmployeesJoinedThisMonth(employees: Array<Record<string, unknown>>): number {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  return employees.filter((emp) => {
    const joined = employeeJoinDate(emp)
    return joined && joined.getMonth() === month && joined.getFullYear() === year
  }).length
}

export function formatEmployeesAddedThisMonth(count: number): string {
  if (count === 0) return 'No hires this month'
  if (count === 1) return '1 added this month'
  return `${count} added this month`
}

export function buildPendingApprovals(
  leaves: LeaveRequest[],
  _pendingDocs: DocumentRequestRecord[] = [],
): PendingApprovalTask[] {
  const tasks: PendingApprovalTask[] = []

  leaves
    .filter((l) => l.status === 'Pending')
    .forEach((l) => {
      const daysLabel = l.days === 1 ? '1 day' : `${l.days} days`
      tasks.push({
        id: `leave-${l.id}`,
        title: `${l.employeeName} (${daysLabel})`,
        requestedAgo: formatRequestedAgo(l.createdAt),
        kind: 'leave',
        sourceId: l.id,
        leaveType: l.type,
      })
    })

  // Dashboard queue shows pending leaves only (max 4). Documents use the Documents KPI card.
  return tasks.slice(0, 4)
}
