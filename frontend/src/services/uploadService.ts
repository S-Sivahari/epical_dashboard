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
  const { data } = await api.get(`/employees/${employeeId}/documents/${docType}`, {
    responseType: 'blob',
  })
  return data
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

export async function fetchEmployeePhoto(employeeId: string): Promise<Blob | null> {
  try {
    const { data, status } = await api.get(`/employees/${employeeId}/photo`, {
      responseType: 'blob',
    })
    if (status !== 200) return null
    return data
  } catch {
    return null
  }
}

/** Legacy URL helper — img tags cannot send Authorization; prefer fetchEmployeePhoto + blob URL. */
export function getDocumentUrl(employeeId: string, docType: string) {
  return `${api.defaults.baseURL}/employees/${employeeId}/documents/${docType}`
}

export function getPhotoUrl(employeeId: string) {
  return `${api.defaults.baseURL}/employees/${employeeId}/photo`
}
