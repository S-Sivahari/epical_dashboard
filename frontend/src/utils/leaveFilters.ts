import type { LeaveRequest } from '@/types'

export interface LeaveFilters {
  selectedEmployees: string[]  // multi-select by employee name
  status: string
  leaveType?: string           // filter by leave type (Sick Leave, Casual Leave, Earned Leave)
  dateFrom?: string            // filter by leave period start (YYYY-MM-DD)
  dateTo?: string              // filter by leave period end (YYYY-MM-DD)
}

function formatDateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Current calendar month as YYYY-MM-DD (local), for monthly leave request views. */
export function getCurrentMonthDateRange() {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: formatDateKey(first), to: formatDateKey(last) }
}

export function getCurrentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${now.getMonth()}`
}

export function formatMonthLabel(monthStart: string) {
  const d = new Date(`${monthStart}T12:00:00`)
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

/** True when a YYYY-MM-DD key falls within [from, to] inclusive. */
export function isDateKeyInRange(dateKey: string, from: string, to: string) {
  return dateKey >= from && dateKey <= to
}

export const defaultLeaveFilters: LeaveFilters = {
  selectedEmployees: [],
  status: 'All',
  leaveType: '',
  dateFrom: getCurrentMonthDateRange().from,
  dateTo: getCurrentMonthDateRange().to,
}

/** True when leave period [from, to] overlaps filter range [dateFrom, dateTo]. */
function leavePeriodOverlapsRange(
  from: string,
  to: string,
  dateFrom?: string,
  dateTo?: string,
): boolean {
  // If no date filters are set, include all leaves
  if (!dateFrom && !dateTo) return true
  
  // If both date filters are set, check overlap
  if (dateFrom && dateTo) {
    return from <= dateTo && to >= dateFrom
  }
  
  // If only dateFrom is set, include leaves that start on or after dateFrom
  if (dateFrom && !dateTo) {
    return to >= dateFrom
  }
  
  // If only dateTo is set, include leaves that end on or before dateTo
  if (!dateFrom && dateTo) {
    return from <= dateTo
  }
  
  return true
}

export function excludeCancelledLeaves(leaves: LeaveRequest[]): LeaveRequest[] {
  return leaves.filter((l) => l.status !== 'Cancelled')
}

function todayLocalISO(): string {
  const now = new Date()
  return formatDateKey(now)
}

/** Pending always cancellable; approved only before the leave period ends. */
export function canCancelLeave(leave: Pick<LeaveRequest, 'status' | 'to'>): boolean {
  if (leave.status === 'Pending') return true
  if (leave.status === 'Approved') {
    const end = typeof leave.to === 'string' ? leave.to.slice(0, 10) : ''
    return Boolean(end && end >= todayLocalISO())
  }
  return false
}

/** True when an approved leave period has fully ended (end date before today). */
export function isLeaveEnded(leave: Pick<LeaveRequest, 'to'>): boolean {
  const end = typeof leave.to === 'string' ? leave.to.slice(0, 10) : ''
  return Boolean(end && end < todayLocalISO())
}

/** Upcoming/current approved leaves first (by start date), then past approved leaves. */
export function sortApprovedLeavesUpcomingFirst(leaves: LeaveRequest[]): LeaveRequest[] {
  const today = todayLocalISO()
  const upcoming = leaves
    .filter((l) => {
      const end = typeof l.to === 'string' ? l.to.slice(0, 10) : ''
      return Boolean(end && end >= today)
    })
    .sort((a, b) => a.from.localeCompare(b.from))
  const past = leaves
    .filter((l) => {
      const end = typeof l.to === 'string' ? l.to.slice(0, 10) : ''
      return Boolean(end && end < today)
    })
    .sort((a, b) => a.from.localeCompare(b.from))
  return [...upcoming, ...past]
}

function toDateKey(value: unknown): string | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(d.getTime())) return null
  return formatDateKey(d)
}

/** When a rejected leave was last actioned (reject pending or revoke approved). */
export function getLeaveRejectionDateKey(leave: LeaveRequest): string | null {
  if (leave.status !== 'Rejected') return null
  return toDateKey(leave.rejectedAt ?? leave.updatedAt ?? leave.createdAt)
}

/** True if a rejected leave was previously approved (admin revoked). */
export function isRevokedApprovedLeave(leave: LeaveRequest): boolean {
  return leave.status === 'Rejected' && Boolean(leave.approvalDate ?? leave.approvedAt ?? leave.approvedBy)
}

function leaveMatchesMonthFilter(leave: LeaveRequest, filters: LeaveFilters): boolean {
  const { dateFrom, dateTo } = filters
  const periodMatch = leavePeriodOverlapsRange(leave.from, leave.to, dateFrom, dateTo)

  // Pending requests applied this month should appear even when leave dates fall in a future month.
  if (leave.status === 'Pending' && dateFrom && dateTo) {
    const appliedKey = toDateKey(leave.createdAt)
    const appliedThisMonth =
      appliedKey != null && isDateKeyInRange(appliedKey, dateFrom, dateTo)
    if (appliedThisMonth || periodMatch) return true
    return false
  }

  if (leave.status !== 'Rejected' || !dateFrom || !dateTo) {
    return periodMatch
  }

  const rejectionKey = getLeaveRejectionDateKey(leave)
  const rejectionMatch =
    rejectionKey != null && isDateKeyInRange(rejectionKey, dateFrom, dateTo)

  return periodMatch || rejectionMatch
}

export function filterLeaves(leaves: LeaveRequest[], filters: LeaveFilters): LeaveRequest[] {
  return leaves.filter((l) => {
    const matchName =
      filters.selectedEmployees.length === 0 ||
      filters.selectedEmployees.includes(l.employeeName)
    const matchStatus = filters.status === 'All' || l.status === filters.status
    const matchType =
      !filters.leaveType ||
      l.type === filters.leaveType
    const matchDate = leaveMatchesMonthFilter(l, filters)
    return matchName && matchStatus && matchType && matchDate
  })
}

/** Compact day count for leave tables and feeds (e.g. 3d, 0.5d). */
export function formatLeaveDayCount(leave: {
  days?: number
  leaveDuration?: string
}): string {
  if (leave.leaveDuration === 'Half Day') return '0.5d'
  const days = Number(leave.days)
  if (Number.isNaN(days)) return '—'
  return `${days}d`
}
