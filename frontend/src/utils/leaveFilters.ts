import type { LeaveRequest } from '@/types'

export interface LeaveFilters {
  selectedEmployees: string[]  // multi-select by employee name
  employeeId: string
  status: string
  leaveType?: string           // filter by leave type (Sick Leave, Casual Leave, Earned Leave)
  dateFrom?: string            // filter by leave start date (YYYY-MM-DD)
  dateTo?: string              // filter by leave end date (YYYY-MM-DD)
}

export const defaultLeaveFilters: LeaveFilters = {
  selectedEmployees: [],
  employeeId: '',
  status: 'All',
  leaveType: '',
  dateFrom: '',
  dateTo: '',
}

export function filterLeaves(leaves: LeaveRequest[], filters: LeaveFilters): LeaveRequest[] {
  return leaves.filter((l) => {
    const matchName =
      filters.selectedEmployees.length === 0 ||
      filters.selectedEmployees.includes(l.employeeName)
    const matchId =
      !filters.employeeId ||
      (l.employeeId || '').toLowerCase().includes(filters.employeeId.toLowerCase())
    const matchStatus = filters.status === 'All' || l.status === filters.status
    const matchType =
      !filters.leaveType ||
      l.type === filters.leaveType
    // Date range: leave must overlap with [dateFrom, dateTo]
    const matchDateFrom = !filters.dateFrom || l.to >= filters.dateFrom
    const matchDateTo = !filters.dateTo || l.from <= filters.dateTo
    return matchName && matchId && matchStatus && matchType && matchDateFrom && matchDateTo
  })
}
