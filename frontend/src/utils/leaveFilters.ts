import type { LeaveRequest } from '@/types'

export interface LeaveFilters {
  employeeName: string
  employeeId: string
  department: string
  reportingManager: string
}

export const defaultLeaveFilters: LeaveFilters = {
  employeeName: '',
  employeeId: '',
  department: 'All',
  reportingManager: '',
}

export function filterLeaves(leaves: LeaveRequest[], filters: LeaveFilters): LeaveRequest[] {
  return leaves.filter((l) => {
    const matchName = !filters.employeeName || (l.employeeName || '').toLowerCase().includes(filters.employeeName.toLowerCase())
    const matchId = !filters.employeeId || (l.employeeId || '').toLowerCase().includes(filters.employeeId.toLowerCase())
    const matchDept = filters.department === 'All' || l.department === filters.department
    const matchMgr = !filters.reportingManager || (l.reportingManager || '').toLowerCase().includes(filters.reportingManager.toLowerCase())
    
    return matchName && matchId && matchDept && matchMgr
  })
}
