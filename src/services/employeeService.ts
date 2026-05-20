import type { Employee } from '@/types'
import { MOCK_EMPLOYEES } from '@services/mockData'

const delay = (ms = 280) => new Promise((r) => setTimeout(r, ms))

let employees = [...MOCK_EMPLOYEES]

export async function getEmployees(params?: {
  q?: string
  department?: string
  employmentType?: string
  employmentStatus?: string
  status?: string
  page?: number
  pageSize?: number
}) {
  await delay()
  let list = [...employees]
  if (params?.q) {
    const q = params.q.toLowerCase()
    list = list.filter(
      (e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q),
    )
  }
  if (params?.department && params.department !== 'all') {
    list = list.filter((e) => e.department === params.department)
  }
  if (params?.employmentType && params.employmentType !== 'all') {
    list = list.filter((e) => e.employmentType === params.employmentType)
  }
  if (params?.employmentStatus && params.employmentStatus !== 'all') {
    list = list.filter((e) => (e.employmentStatus || 'Active') === params.employmentStatus)
  }
  if (params?.status && params.status !== 'all') {
    list = list.filter((e) => e.status === params.status)
  }
  const page = params?.page ?? 1
  const pageSize = params?.pageSize ?? 10
  const start = (page - 1) * pageSize
  const paged = list.slice(start, start + pageSize)
  return { data: paged, total: list.length, page, pageSize }
}

export async function getEmployee(id: string) {
  await delay()
  const e = employees.find((x) => x.id === id)
  if (!e) throw new Error('Not found')
  return e
}

export async function createEmployee(payload: Omit<Employee, 'id'>) {
  await delay()
  const id = `E-${1000 + employees.length + 1}`
  const row: Employee = { ...payload, id }
  employees = [row, ...employees]
  return row
}

export async function updateEmployee(id: string, payload: Partial<Employee>) {
  await delay()
  employees = employees.map((e) => (e.id === id ? { ...e, ...payload } : e))
  return getEmployee(id)
}

export async function deleteEmployee(id: string) {
  await delay()
  employees = employees.filter((e) => e.id !== id)
}
