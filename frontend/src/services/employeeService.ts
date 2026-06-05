import type { Employee } from '@/types'
import api from '@services/api'

export async function getEmployees(params?: {
  name?: string
  employmentType?: string
  status?: string
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}) {
  const response = await api.get('/employees', {
    params: {
      q: params?.name || undefined,
      employmentType: params?.employmentType,
      status: params?.status,
      sortColumn: params?.sortColumn,
      sortDirection: params?.sortDirection,
      page: params?.page,
      pageSize: params?.pageSize,
    },
  })
  return response.data as { data: Employee[]; total: number; page: number; pageSize: number }
}

export async function getEmployee(id: string) {
  const response = await api.get(`/employees/${id}`)
  return response.data as Employee
}

/** Current logged-in employee's profile — resolves by auth token, not cached user.id. */
export async function getMyEmployee() {
  const response = await api.get('/employees/me')
  return response.data as Employee
}

export async function createEmployee(
  payload: Omit<Employee, 'id'>,
) {
  const backendPayload: any = { ...payload }
  // Map companyEmail to email if email is not present on the payload
  if (!backendPayload.email && backendPayload.companyEmail) {
    backendPayload.email = backendPayload.companyEmail
  }
  // Ensure email is set if either was passed
  if (!backendPayload.email) {
    backendPayload.email = (payload as any).email || (payload as any).companyEmail || ''
  }
  // Remove the frontend‑only field to avoid sending duplicate/unused data
  delete backendPayload.companyEmail

  const response = await api.post('/employees', backendPayload)
  return response.data as Employee
}

export async function updateEmployee(id: string, payload: Partial<Employee>, changedBy?: string) {
  // Create a copy of payload to avoid mutating the original
  const backendPayload: any = { ...payload };
  if (changedBy) {
    backendPayload.changedBy = changedBy;
  }
  // Map companyEmail to email if email is not present on the payload
  if (!backendPayload.email && backendPayload.companyEmail) {
    backendPayload.email = backendPayload.companyEmail;
  }
  // Ensure email is set if either was passed
  if (!backendPayload.email && ((payload as any).email || (payload as any).companyEmail)) {
    backendPayload.email = (payload as any).email || (payload as any).companyEmail;
  }
  // Remove the frontend‑only field before sending to backend
  delete backendPayload.companyEmail;

  const response = await api.put(`/employees/${id}`, backendPayload);
  return response.data as Employee;
}

export async function deleteEmployee(id: string) {
  await api.delete(`/employees/${id}`)
}

export async function updateEmployeeStatus(
  id: string,
  status: Employee['status'],
  reason?: string,
  changedBy?: string,
) {
  const response = await api.patch(`/employees/${id}/status`, {
    status,
    reason,
    changedBy,
  })
  return response.data as Employee
}

export async function bulkUpdateStatus(
  ids: string[],
  status: string,
  reason: string,
  changedBy?: string,
) {
  const response = await api.patch('/employees/bulk-status', { ids, status, reason, changedBy })
  return response.data as { updated: number }
}

export async function checkEmployeeIdExists(employeeId: string): Promise<boolean> {
  const response = await api.get('/employees/check-id', { params: { id: employeeId } })
  return (response.data as { exists: boolean }).exists
}

export async function getEmployeeDocuments(id: string) {
  const response = await api.get(`/employees/${id}/documents`, {
    validateStatus: (s) => s === 200 || s === 404,
  })
  if (response.status === 404) return []
  return (response.data as { key: string; name: string; uploadedAt?: string }[]).map((doc) => ({
    key: doc.key,
    name: doc.name,
    uploadedAt: doc.uploadedAt,
  }))
}
