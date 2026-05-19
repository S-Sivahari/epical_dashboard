import type { Employee } from '@/types'
import { MOCK_EMPLOYEES } from '@services/mockData'

const delay = (ms = 280) => new Promise((r) => setTimeout(r, ms))

let employees = [...MOCK_EMPLOYEES]

const EMPLOYEE_ID_PATTERN = /^(EPL|INT)\d{8}$/

const normalizeEmployeeId = (value?: string) => (value ?? '').trim().toUpperCase()

const isEmployeeIdUnique = (employeeId: string) =>
  !employees.some((e) => e.employeeId.toUpperCase() === employeeId)

const generateEmployeeId = () => {
  const prefixes = ['EPL', 'INT']
  for (let i = 0; i < 20; i += 1) {
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
    const digits = Math.floor(Math.random() * 1_0000_0000)
      .toString()
      .padStart(8, '0')
    const candidate = `${prefix}${digits}`
    if (isEmployeeIdUnique(candidate)) return candidate
  }
  const fallback = `${prefixes[0]}${Date.now().toString().slice(-8)}`
  return isEmployeeIdUnique(fallback) ? fallback : `${fallback}${employees.length}`
}

export async function getEmployees(params?: {
  q?: string
  department?: string
  employmentType?: string
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
        e.id.toLowerCase().includes(q) ||
        e.employeeId.toLowerCase().includes(q),
    )
  }
  if (params?.department && params.department !== 'all') {
    list = list.filter((e) => e.department === params.department)
  }
  if (params?.employmentType && params.employmentType !== 'all') {
    list = list.filter((e) => e.employmentType === params.employmentType)
  }
  if (params?.status && params.status !== 'all') {
    list = list.filter((e) => e.status === params.status)
  } else if (!params?.status || params.status === 'all') {
    // Default: show everything except deactivated/archived
    list = list.filter((e) => e.status !== 'Deactivated' && e.status !== 'Archived')
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

export async function createEmployee(payload: Omit<Employee, 'id'> & { employeeId?: string }) {
  await delay()
  const id = `E-${1000 + employees.length + 1}`
  const requestedId = normalizeEmployeeId(payload.employeeId)
  const employeeId = requestedId || generateEmployeeId()
  if (!EMPLOYEE_ID_PATTERN.test(employeeId)) {
    throw new Error('Employee ID must be EPL or INT plus 8 digits.')
  }
  if (!isEmployeeIdUnique(employeeId)) {
    throw new Error('Employee ID already exists.')
  }
  const row: Employee = { ...payload, employeeId, id }
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

export async function updateEmployeeStatus(id: string, status: Employee['status']) {
  await delay()
  employees = employees.map((e) => (e.id === id ? { ...e, status } : e))
}


