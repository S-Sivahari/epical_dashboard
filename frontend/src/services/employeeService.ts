import type { Employee } from '@/types'
import api from '@services/api'

export async function getEmployees(params?: {
  name?: string
  employeeId?: string
  department?: string
  employmentType?: string
  status?: string
  page?: number
  pageSize?: number
}) {
  const response = await api.get('/employees', { params })
  return response.data as { data: Employee[]; total: number; page: number; pageSize: number }
}

export async function getEmployee(id: string) {
  const response = await api.get(`/employees/${id}`)
  return response.data as Employee
}

export async function createEmployee(
  payload: Omit<Employee, 'id'> & { employeeId?: string },
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
