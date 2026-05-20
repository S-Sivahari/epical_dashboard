import type { LeaveRequest } from '@/types'

export interface LeaveFilters {
  employeeName: string
  employeeId: string
  status: string
}

export const defaultLeaveFilters: LeaveFilters = {
  employeeName: '',
  employeeId: '',
  status: 'All',
}

export function filterLeaves(leaves: LeaveRequest[], filters: LeaveFilters): LeaveRequest[] {
  return leaves.filter((l) => {
    const matchName = !filters.employeeName || (l.employeeName || '').toLowerCase().includes(filters.employeeName.toLowerCase())
    const matchId = !filters.employeeId || (l.employeeId || '').toLowerCase().includes(filters.employeeId.toLowerCase())
    const matchStatus = filters.status === 'All' || l.status === filters.status
    
    return matchName && matchId && matchStatus
  })
}
