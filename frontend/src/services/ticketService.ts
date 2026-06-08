import type { Ticket, TicketPriority, TicketStatus } from '@/types'
import api from '@services/api'

export interface TicketFilters {
  q?: string
  priority?: string
  status?: string
  employeeId?: string
}

/** Params sent to `/tickets`; omits undefined, empty strings, and literal `"all"`. */
function buildTicketParams(filters?: TicketFilters): Record<string, string> {
  const out: Record<string, string> = {}
  if (!filters) return out
  for (const [key, raw] of Object.entries(filters)) {
    if (raw === undefined || raw === null) continue
    const v = String(raw).trim()
    if (!v || v === 'all') continue
    out[key] = v
  }
  return out
}

export async function getTickets(filters?: TicketFilters): Promise<Ticket[]> {
  const params = buildTicketParams(filters)
  const response = await api.get('/tickets', { params })
  return response.data as Ticket[]
}

export async function getTicketById(id: string): Promise<Ticket> {
  const response = await api.get(`/tickets/${id}`)
  return response.data as Ticket
}

/** Alias for detail views */
export async function fetchTicketById(id: string): Promise<Ticket> {
  return getTicketById(id)
}

export async function createTicket(payload: {
  employeeId: string
  employeeName: string
  title: string
  description?: string
  priority: TicketPriority
}): Promise<Ticket> {
  const response = await api.post('/tickets', payload)
  return response.data as Ticket
}

export async function updateTicketStatus(
  id: string,
  status: TicketStatus,
  remark?: string
): Promise<Ticket> {
  const response = await api.patch(`/tickets/${id}/status`, { status, remark })
  return response.data as Ticket
}

export async function addTicketComment(id: string, text: string): Promise<Ticket> {
  const response = await api.post(`/tickets/${id}/comments`, { text })
  return response.data as Ticket
}

export async function uploadTicketAttachment(id: string, file: File): Promise<Ticket> {
  const formData = new FormData()
  formData.append('attachment', file)
  const response = await api.post(`/tickets/${id}/attachment`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data as Ticket
}

export function getTicketAttachmentUrl(id: string): string {
  const base = api.defaults.baseURL || '/api'
  return `${base}/tickets/${id}/attachment`
}

export async function openTicketAttachment(id: string, filename?: string): Promise<void> {
  const response = await api.get(`/tickets/${id}/attachment`, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  if (filename) link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function deleteTicket(id: string): Promise<void> {
  await api.delete(`/tickets/${id}`)
}

const PIPELINE: TicketStatus[] = ['Pending', 'In Progress', 'Completed']

export function getNextStatus(status: TicketStatus): TicketStatus | null {
  const i = PIPELINE.indexOf(status)
  if (i === -1 || i >= PIPELINE.length - 1) return null
  return PIPELINE[i + 1]
}

/** Matches backend reversible transitions — previous step along the default pipeline only. */
export function getPrevStatus(status: TicketStatus): TicketStatus | null {
  const i = PIPELINE.indexOf(status)
  if (i <= 0) return null
  return PIPELINE[i - 1]
}