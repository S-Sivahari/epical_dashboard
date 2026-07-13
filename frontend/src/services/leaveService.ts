import type {
  EmployeeLeaveSummary,
  Holiday,
  LeaveAllocationActivity,
  LeaveRequest,
  YearLeaveBalanceRow,
  YearLeaveBalancesResponse,
  YearLeaveBalanceUpdate,
} from '@/types'
import api from '@services/api'
import { downloadWithAuth } from '@/utils/downloadWithAuth'

export async function getLeaves() {
  const response = await api.get('/leaves')
  return response.data as LeaveRequest[]
}

export async function getLeaveHistory(employeeId?: string) {
  const response = await api.get('/leaves/history', {
    params: employeeId ? { employeeId } : undefined,
  })
  return response.data as LeaveRequest[]
}

export async function getBalances(employeeId?: string) {
  const response = await api.get('/leaves/balances', {
    params: employeeId ? { employeeId } : undefined,
  })
  return response.data as Record<string, { total: number; used: number; remaining: number }>
}

export async function getEmployeeLeaveSummary(employeeId: string) {
  const response = await api.get(`/leaves/employee/${employeeId}/summary`)
  return response.data as EmployeeLeaveSummary
}

export async function updateEmployeeLeaveAllocations(
  employeeId: string,
  allocations: Partial<Record<'Casual Leave' | 'Sick Leave' | 'Earned Leave', number>>,
) {
  const response = await api.patch(`/leaves/employee/${employeeId}/allocations`, allocations)
  return response.data as { allocations: Record<string, number> }
}

export async function adjustEmployeeLeaveBalance(
  employeeId: string,
  type: 'Casual Leave' | 'Sick Leave' | 'Earned Leave' | 'Compensation Leave',
  delta: number,
) {
  const response = await api.patch(`/leaves/employee/${employeeId}/balance-adjustment`, { type, delta })
  return response.data as EmployeeLeaveSummary
}

export async function adjustEmployeeLeaveBalances(
  employeeId: string,
  adjustments: Partial<
    Record<'Casual Leave' | 'Sick Leave' | 'Earned Leave' | 'Compensation Leave', number>
  >,
) {
  const response = await api.patch(`/leaves/employee/${employeeId}/balance-adjustments`, {
    adjustments,
  })
  return response.data as EmployeeLeaveSummary
}

export async function getYearLeaveBalances(year?: number) {
  const response = await api.get('/leaves/year-balances', {
    params: year !== undefined ? { year } : undefined,
  })
  return response.data as YearLeaveBalancesResponse
}

export async function updateEmployeeYearLeaveBalances(
  employeeId: string,
  year: number,
  balances: YearLeaveBalanceUpdate[],
) {
  const response = await api.patch(`/leaves/employee/${employeeId}/year-balances`, {
    year,
    balances,
  })
  return response.data as YearLeaveBalanceRow
}

export async function getLeaveAllocationActivities(from?: string, to?: string) {
  const response = await api.get('/leaves/allocation-activities', {
    params: { from, to },
  })
  return response.data as LeaveAllocationActivity[]
}

export async function createLeave(payload: {
  employeeId: string
  employeeName: string
  type: string
  leaveDuration: 'Full Day' | 'Half Day'
  halfDaySession?: 'First Half' | 'Second Half'
  from: string
  to: string
  reason?: string
}) {
  const response = await api.post('/leaves', payload)
  return response.data as LeaveRequest
}

export async function approveLeave(id: string) {
  const response = await api.patch(`/leaves/${id}/approve`)
  return response.data as LeaveRequest
}

export async function rejectLeave(id: string, reason: string) {
  const response = await api.patch(`/leaves/${id}/reject`, { reason })
  return response.data as LeaveRequest
}

export async function cancelLeave(id: string) {
  const response = await api.patch(`/leaves/${id}/cancel`, {})
  return response.data as LeaveRequest
}

export async function revokeApprovedLeave(id: string, reason: string) {
  const response = await api.patch(`/leaves/${id}/revoke`, { reason })
  return response.data as LeaveRequest
}

export async function deleteLeave(id: string) {
  await api.delete(`/leaves/${id}`)
}

export async function deleteAllLeaves(): Promise<{ deletedCount: number }> {
  const response = await api.delete('/leaves/all')
  return response.data as { deletedCount: number }
}

export async function addHoliday(payload: Omit<Holiday, 'id'>) {
  const response = await api.post('/holidays', payload)
  return response.data as Holiday
}

export async function addHolidaysBulk(payload: {
  title: string
  type: Holiday['type']
  description?: string
  dates: string[]
}) {
  const response = await api.post<{ created: Holiday[]; skippedDates: string[] }>(
    '/holidays/bulk',
    payload,
  )
  return response.data
}

export async function updateHoliday(id: string, payload: Partial<Omit<Holiday, 'id'>>) {
  const response = await api.put(`/holidays/${id}`, payload)
  return response.data as Holiday
}

export async function deleteHoliday(id: string) {
  await api.delete(`/holidays/${id}`)
}

export async function skipHoliday(id: string, reason?: string) {
  const response = await api.patch(`/holidays/${id}/skip`, { reason })
  return response.data as Holiday
}

export async function getHolidays() {
  const response = await api.get('/holidays')
  return response.data as Holiday[]
}

export async function downloadHolidayImportTemplate() {
  await downloadWithAuth('/holidays/import/template', 'holiday_import_template.xlsx')
}

export type HolidayImportResult = {
  created: Holiday[]
  skipped: Array<{ rowNumber: number; date: string; title: string; reason: string }>
  rowErrors: Array<{ rowNumber: number; errors: string[] }>
  summary: Array<{ title: string; typeLabel: string; dateLabel: string }>
}

export async function importHolidaysFromExcel(file: File): Promise<HolidayImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post('/holidays/import/upload', formData)
  return response.data as HolidayImportResult
}

export interface TeamLeaveEntry {
  id: string
  employeeName: string
  type: string
  from: string
  to: string
  days: number
}

export async function getTeamLeaves(): Promise<TeamLeaveEntry[]> {
  const response = await api.get('/leaves/team')
  return response.data as TeamLeaveEntry[]
}

export function seedPendingLeaves(): LeaveRequest[] {
  // No longer using mock data — this is a no-op kept for compatibility.
  // The dashboard should call getLeaves() and filter by status instead.
  return []
}
