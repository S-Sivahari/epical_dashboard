import api from '@services/api'

export async function uploadDocuments(
  employeeId: string,
  documents: {
    aadhaarPan?: File | null
    offerLetter?: File | null
    certificates?: File | null
    agreement?: File | null
  }
) {
  const formData = new FormData()

  if (documents.aadhaarPan) formData.append('aadhaarPan', documents.aadhaarPan)
  if (documents.offerLetter) formData.append('offerLetter', documents.offerLetter)
  if (documents.certificates) formData.append('certificates', documents.certificates)
  if (documents.agreement) formData.append('agreement', documents.agreement)

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

export function getDocumentUrl(employeeId: string, docType: string) {
  return `${api.defaults.baseURL}/employees/${employeeId}/documents/${docType}`
}

export function getPhotoUrl(employeeId: string) {
  return `${api.defaults.baseURL}/employees/${employeeId}/photo`
}
