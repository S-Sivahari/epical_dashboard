import api from '@services/api'

export async function uploadDocuments(
  employeeId: string,
  documents: Record<string, File | null | undefined>
) {
  const formData = new FormData()

  Object.entries(documents).forEach(([key, file]) => {
    if (file) formData.append(key, file)
  })

  const response = await api.post(`/employees/${employeeId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  return response.data
}

export async function uploadPhoto(employeeId: string, photo: File) {
  const formData = new FormData()
  formData.append('photo', photo)

  const response = await api.post(`/employees/${employeeId}/photo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  return response.data
}

export async function deleteDocument(employeeId: string, docType: string) {
  const response = await api.delete(`/employees/${employeeId}/documents/${docType}`)
  return response.data
}

export async function fetchEmployeeDocument(employeeId: string, docType: string): Promise<Blob> {
  const res = await api.get(`/employees/${employeeId}/documents/${docType}`, {
    responseType: 'blob',
    validateStatus: (s) => s === 200 || s === 404,
  })
  if (res.status === 404) {
    throw new Error('Document not found')
  }
  const blob = res.data as Blob
  if (blob.type?.includes('application/json')) {
    const text = await blob.text()
    const parsed = JSON.parse(text) as { error?: string }
    throw new Error(parsed.error || 'Failed to load document')
  }
  return blob
}

export async function openEmployeeDocument(
  employeeId: string,
  docType: string,
  _filename?: string
): Promise<void> {
  const blob = await fetchEmployeeDocument(employeeId, docType)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
