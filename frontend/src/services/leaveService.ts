import type { Holiday, LeaveRequest } from '@/types'
import api from '@services/api'

export async function getLeaves() {
  const response = await api.get('/leaves')
  return response.data as LeaveRequest[]
}

export async function getBalances() {
  const response = await api.get('/leaves/balances')
  return response.data as Record<string, { total: number; used: number; remaining: number }>
}

export async function createLeave(payload: {
  employeeId: string
  employeeName: string
  type: string
  from: string
  to: string
  days: number
  reason: string
}) {
  const response = await api.post('/leaves', payload)
  return response.data as LeaveRequest
}

export async function approveLeave(id: string) {
  await api.patch(`/leaves/${id}/approve`)
}

export async function rejectLeave(id: string) {
  await api.patch(`/leaves/${id}/reject`)
}

export async function addHoliday(payload: Omit<Holiday, 'id'>) {
  const response = await api.post('/holidays', payload)
  return response.data as Holiday
}

export async function getHolidays() {
  const response = await api.get('/holidays')
  return response.data as Holiday[]
}

export function seedPendingLeaves(): LeaveRequest[] {
  // No longer using mock data — this is a no-op kept for compatibility.
  // The dashboard should call getLeaves() and filter by status instead.
  return []
}
