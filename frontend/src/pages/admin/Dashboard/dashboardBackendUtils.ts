import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import type { DocumentRequestRecord, LeaveRequest } from '@/types'
import type { PendingApprovalTask } from './dashboardRightWorkspaceData'
import type { UpcomingDeadline } from './dashboardLeftPanelsData'

const PROBATION_DAYS = 90

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
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 14) return '1w ago'
  return format(date, 'MMM d')
}

function deadlineUrgency(target: Date): UpcomingDeadline['urgency'] {
  const days = differenceInCalendarDays(target, startOfDay(new Date()))
  if (days <= 0) return 'red'
  if (days <= 2) return 'amber'
  return 'green'
}

function employeeDisplayName(emp: Record<string, unknown>): string {
  const name = typeof emp.name === 'string' ? emp.name.trim() : ''
  if (name) return name
  const first = typeof emp.firstName === 'string' ? emp.firstName : ''
  const last = typeof emp.lastName === 'string' ? emp.lastName : ''
  return `${first} ${last}`.trim() || 'Employee'
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
  pendingDocs: DocumentRequestRecord[],
): PendingApprovalTask[] {
  const tasks: PendingApprovalTask[] = []

  leaves
    .filter((l) => l.status === 'Pending')
    .forEach((l) => {
      const daysLabel = l.days === 1 ? '1 Day' : `${l.days} Days`
      tasks.push({
        id: `leave-${l.id}`,
        title: `Review Leave Request: ${l.employeeName} (${daysLabel})`,
        requestedAgo: formatRequestedAgo(l.createdAt),
        kind: 'leave',
        sourceId: l.id,
      })
    })

  pendingDocs.forEach((doc) => {
    tasks.push({
      id: `doc-${doc.id}`,
      title: `Document Verification: ${doc.documentName} — ${doc.employeeName}`,
      requestedAgo: formatRequestedAgo(doc.requestedAt),
      kind: 'document',
      sourceId: doc.id,
      hasFulfillmentFile: !!doc.hasFulfillmentFile,
    })
  })

  return tasks.slice(0, 12)
}

export function buildUpcomingDeadlines(
  employees: Array<Record<string, unknown>>,
  payslipBatches: Array<Record<string, unknown>>,
  holidays: Array<{ date: string; name?: string; title?: string }>,
): UpcomingDeadline[] {
  const today = startOfDay(new Date())
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
  const weekInterval = { start: today, end: weekEnd }
  const items: { target: Date; label: string }[] = []

  items.push({
    target: weekEnd,
    label: 'Timesheet cutoff — current period',
  })

  const latestBatch = payslipBatches[0]
  if (latestBatch) {
    const payDate =
      safeParseDate(
        typeof latestBatch.payDate === 'string'
          ? latestBatch.payDate
          : typeof latestBatch.createdAt === 'string'
            ? latestBatch.createdAt
            : undefined,
      ) ?? addDays(today, 2)
    const payMonth =
      typeof latestBatch.payMonth === 'string' ? latestBatch.payMonth : 'current cycle'
    items.push({
      target: payDate,
      label: `Payroll run — ${payMonth}`,
    })
  }

  employees.forEach((emp) => {
    const joined = safeParseDate(typeof emp.joinedAt === 'string' ? emp.joinedAt : undefined)
    if (!joined) return
    const probationEnd = addDays(joined, PROBATION_DAYS)
    if (isWithinInterval(probationEnd, weekInterval)) {
      items.push({
        target: probationEnd,
        label: `Probation end — ${employeeDisplayName(emp)}`,
      })
    }
  })

  holidays.forEach((h) => {
    const date = safeParseDate(h.date)
    if (!date || !isWithinInterval(date, weekInterval)) return
    const title = h.name || h.title || 'Company holiday'
    items.push({
      target: date,
      label: title,
    })
  })

  const friday = endOfWeek(startOfWeek(today, { weekStartsOn: 1 }), { weekStartsOn: 1 })
  if (!items.some((i) => i.label.includes('Timesheet'))) {
    items.unshift({ target: friday, label: 'Timesheet cutoff — current period' })
  }

  return items
    .filter((item) => differenceInCalendarDays(item.target, today) >= -1)
    .sort((a, b) => a.target.getTime() - b.target.getTime())
    .slice(0, 8)
    .map((item, index) => ({
      id: `deadline-${index}-${format(item.target, 'yyyy-MM-dd')}`,
      dateLabel: format(item.target, 'MMM d'),
      label: item.label,
      urgency: deadlineUrgency(item.target),
    }))
}
