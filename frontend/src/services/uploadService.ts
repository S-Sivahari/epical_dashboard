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

export function getDocumentUrl(employeeId: string, docType: string) {
  return `${api.defaults.baseURL}/employees/${employeeId}/documents/${docType}`
}

export function getPhotoUrl(employeeId: string) {
  return `${api.defaults.baseURL}/employees/${employeeId}/photo`
}
