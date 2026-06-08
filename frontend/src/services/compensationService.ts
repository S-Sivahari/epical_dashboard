import api from '@services/api'

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
  const { data } = await api.get<CompensationEntry[]>('/compensation')
  return data
}

export async function createCompensation(
  entries: CreateCompensationPayload[],
): Promise<CompensationEntry[]> {
  const { data } = await api.post<CompensationEntry[]>('/compensation', { entries })
  return data
}

export async function updateCompensation(
  id: string,
  payload: { days?: number; reason?: string },
): Promise<CompensationEntry> {
  const { data } = await api.put<CompensationEntry>(`/compensation/${id}`, payload)
  return data
}

export async function deleteCompensation(id: string): Promise<{ success: boolean; message?: string; skipped?: boolean; deleted?: boolean }> {
  const { data } = await api.delete<{ success: boolean; message?: string; skipped?: boolean; deleted?: boolean }>(`/compensation/${id}`)
  return data
}
