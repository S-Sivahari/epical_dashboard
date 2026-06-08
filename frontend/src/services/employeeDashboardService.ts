import api from './api'

export async function fetchEmployeeDashboard() {
  const response = await api.get('/dashboard/employee')
  return response.data
}
