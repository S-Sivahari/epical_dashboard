import axios from 'axios'

const BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/compensation`

export type CompensationStatus = 'Active' | 'Cancelled'

export interface CompensationEntry {
  id: string
  employeeId: string
  employeeName: string
  days: number
  reason: string
  appliedDate: string
  createdBy: string
  status: CompensationStatus
  cancelledAt?: string
  cancelledBy?: string
  cancelReason?: string
  createdAt?: string
}

export interface CreateCompensationPayload {
  employeeId: string
  employeeName: string
  days: number
  reason: string
}

export async function listCompensation(): Promise<CompensationEntry[]> {
  const { data } = await axios.get<CompensationEntry[]>(BASE)
  return data
}

export async function createCompensation(
  entries: CreateCompensationPayload[],
): Promise<CompensationEntry[]> {
  const { data } = await axios.post<CompensationEntry[]>(BASE, { entries })
  return data
}

export async function updateCompensation(
  id: string,
  payload: { days?: number; reason?: string },
): Promise<CompensationEntry> {
  const { data } = await axios.put<CompensationEntry>(`${BASE}/${id}`, payload)
  return data
}

export async function cancelCompensation(
  id: string,
  cancelReason?: string,
): Promise<CompensationEntry> {
  const { data } = await axios.post<CompensationEntry>(`${BASE}/${id}/cancel`, { cancelReason })
  return data
}

export async function deleteCompensation(id: string): Promise<void> {
  await axios.delete(`${BASE}/${id}`)
}
