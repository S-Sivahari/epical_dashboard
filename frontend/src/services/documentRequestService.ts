import api from './api'
import type { DocumentRequestRecord } from '@/types'

export type AdminDocumentTab = 'Requested' | 'Approved' | 'History'

export interface AdminListResponse {
  items: DocumentRequestRecord[]
  total: number
  page: number
  limit: number
}

export async function fetchAdminDocumentRequests(params: {
  status?: DocumentRequestRecord['status']
  mode?: 'history'
  page?: number
  limit?: number
}): Promise<AdminListResponse> {
  const { data } = await api.get<AdminListResponse>('/document-requests', {
    params: {
      ...params,
      page: params.page ?? 1,
      limit: params.limit ?? 10,
    },
  })
  return data
}

export async function uploadFulfillmentFile(id: string, file: File): Promise<DocumentRequestRecord> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.patch<DocumentRequestRecord>(
    `/document-requests/${id}/fulfillment`,
    form,
  )
  return data
}

export async function approveDocumentRequest(id: string): Promise<DocumentRequestRecord> {
  const { data } = await api.patch<DocumentRequestRecord>(
    `/document-requests/${id}/approve`,
    {},
  )
  return data
}

export async function rejectDocumentRequest(
  id: string,
  rejectionReason: string,
): Promise<DocumentRequestRecord> {
  const { data } = await api.patch<DocumentRequestRecord>(`/document-requests/${id}/reject`, {
    rejectionReason,
  })
  return data
}

export async function downloadDocumentPdf(id: string, suggestedName?: string): Promise<void> {
  const res = await api.get(`/document-requests/${id}/download`, { responseType: 'blob' })
  const blob = res.data as Blob
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName || `${id}.pdf`
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Employee endpoints */
export async function createDocumentRequest(payload: {
  documentType: string
  documentName: string
  reason: string
}): Promise<DocumentRequestRecord> {
  const { data } = await api.post<DocumentRequestRecord>('/document-requests', payload)
  return data
}

export async function fetchMyDocumentRequests(): Promise<DocumentRequestRecord[]> {
  const { data } = await api.get<DocumentRequestRecord[]>('/document-requests/me')
  return data
}

export async function downloadMyDocumentPdf(id: string, suggestedName?: string): Promise<void> {
  return downloadDocumentPdf(id, suggestedName)
}
