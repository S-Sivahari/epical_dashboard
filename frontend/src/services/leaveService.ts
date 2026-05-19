import type { Holiday, LeaveRequest } from '@/types'
import { MOCK_HOLIDAYS, MOCK_LEAVES } from '@services/mockData'

const delay = (ms = 280) => new Promise((r) => setTimeout(r, ms))

let leaves = [...MOCK_LEAVES]
let holidays = [...MOCK_HOLIDAYS]

export async function getLeaves() {
  await delay()
  return [...leaves]
}

export async function approveLeave(id: string) {
  await delay()
  leaves = leaves.map((l) => (l.id === id ? { ...l, status: 'Approved' as const } : l))
}

export async function rejectLeave(id: string) {
  await delay()
  leaves = leaves.map((l) => (l.id === id ? { ...l, status: 'Rejected' as const } : l))
}

export async function addHoliday(payload: Omit<Holiday, 'id'>) {
  await delay()
  const h: Holiday = { ...payload, id: `H-${holidays.length + 1}` }
  holidays = [...holidays, h]
  return h
}

export async function getHolidays() {
  await delay()
  return [...holidays]
}

export function seedPendingLeaves(): LeaveRequest[] {
  return leaves.filter((l) => l.status === 'Pending')
}
