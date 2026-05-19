import { create } from 'zustand'
import type { Employee } from '@/types'
import * as employeeService from '@services/employeeService'

interface EmployeeFilters {
  name: string
  employeeId: string
  department: string
  employmentType: string
  status: string
}

interface EmployeeState {
  employees: Employee[]
  selectedEmployee: Employee | null
  filters: EmployeeFilters
  pagination: { page: number; pageSize: number; total: number }
  sort: { column: string; direction: 'asc' | 'desc' }
  loading: boolean
  setFilters: (f: Partial<EmployeeFilters>) => void
  setSort: (column: string, direction: 'asc' | 'desc') => void
  setPage: (page: number) => void
  setPageSize: (n: number) => void
  fetchEmployees: () => Promise<void>
  setSelected: (e: Employee | null) => void
  addEmployee: (payload: Omit<Employee, 'id'>) => Promise<Employee>
  updateEmployee: (id: string, payload: Partial<Employee>) => Promise<void>
  deleteEmployee: (id: string) => Promise<void>
  updateEmployeeStatus: (id: string, status: Employee['status']) => Promise<void>
}

export const useEmployeeStore = create<EmployeeState>((set, get) => ({
  employees: [],
  selectedEmployee: null,
  filters: { name: '', employeeId: '', department: 'all', employmentType: 'all', status: 'all' },
  pagination: { page: 1, pageSize: 10, total: 0 },
  sort: { column: 'joinedAt', direction: 'desc' },
  loading: false,
  setFilters: (f) =>
    set({ filters: { ...get().filters, ...f }, pagination: { ...get().pagination, page: 1 } }),
  setSort: (column, direction) => set({ sort: { column, direction } }),
  setPage: (page) => set({ pagination: { ...get().pagination, page } }),
  setPageSize: (pageSize) => set({ pagination: { ...get().pagination, pageSize, page: 1 } }),
  fetchEmployees: async () => {
    set({ loading: true })
    const { filters, pagination } = get()
    try {
      const res = await employeeService.getEmployees({
        name: filters.name || undefined,
        employeeId: filters.employeeId || undefined,
        department: filters.department,
        employmentType: filters.employmentType,
        status: filters.status,
        sortColumn: get().sort.column,
        sortDirection: get().sort.direction,
        page: pagination.page,
        pageSize: pagination.pageSize,
      })
      set({
        employees: res.data,
        pagination: { ...pagination, total: res.total },
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },
  setSelected: (selectedEmployee) => set({ selectedEmployee }),
  addEmployee: async (payload) => {
    const employee = await employeeService.createEmployee(payload)
    await get().fetchEmployees()
    return employee
  },
  updateEmployee: async (id, payload) => {
    await employeeService.updateEmployee(id, payload)
    await get().fetchEmployees()
  },
  deleteEmployee: async (id) => {
    await employeeService.deleteEmployee(id)
    await get().fetchEmployees()
  },
  updateEmployeeStatus: async (id, status) => {
    await employeeService.updateEmployeeStatus(id, status)
    await get().fetchEmployees()
  },
}))
