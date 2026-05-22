import type { Employee } from '@/types'
import api from '@services/api'

export async function getEmployees(params?: {
  name?: string
  department?: string
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
      department: params?.department,
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

export async function createEmployee(
  payload: Omit<Employee, 'id'>,
) {
  const response = await api.post('/employees', payload)
  return response.data as Employee
}

export async function updateEmployee(id: string, payload: Partial<Employee>) {
  const response = await api.put(`/employees/${id}`, payload)
  return response.data as Employee
}

export async function deleteEmployee(id: string) {
  await api.delete(`/employees/${id}`)
}

export async function updateEmployeeStatus(id: string, status: Employee['status']) {
  const response = await api.put(`/employees/${id}`, { status })
  return response.data as Employee
}

export async function getEmployeeDocuments(id: string) {
  try {
    const response = await api.get(`/employees/${id}/documents`)
    return (response.data as { key: string; name: string; url: string; uploadedAt?: string }[]).map((doc) => ({
      ...doc,
      url: doc.url.startsWith('http') ? doc.url : `${api.defaults.baseURL}${doc.url.replace(/^\/api/, '')}`,
    }))
  } catch {
    // If endpoint doesn't exist yet, return empty array
    return []
  }
}
