import type { LeaveRequest } from '@/types'

export interface LeaveFilters {
  selectedEmployees: string[]  // multi-select by employee name
  status: string
  leaveType?: string           // filter by leave type (Sick Leave, Casual Leave, Earned Leave)
  dateFrom?: string            // filter by leave period start (YYYY-MM-DD)
  dateTo?: string              // filter by leave period end (YYYY-MM-DD)
}

export const defaultLeaveFilters: LeaveFilters = {
  selectedEmployees: [],
  status: 'All',
  leaveType: '',
  dateFrom: '',
  dateTo: '',
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

export function filterLeaves(leaves: LeaveRequest[], filters: LeaveFilters): LeaveRequest[] {
  return leaves.filter((l) => {
    const matchName =
      filters.selectedEmployees.length === 0 ||
      filters.selectedEmployees.includes(l.employeeName)
    const matchStatus = filters.status === 'All' || l.status === filters.status
    const matchType =
      !filters.leaveType ||
      l.type === filters.leaveType
    const matchDate = leavePeriodOverlapsRange(l.from, l.to, filters.dateFrom, filters.dateTo)
    return matchName && matchStatus && matchType && matchDate
  })
}
