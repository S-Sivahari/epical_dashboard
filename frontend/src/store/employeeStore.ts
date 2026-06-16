import { create } from 'zustand'

import { toast } from 'sonner'

import type { Employee } from '@/types'

import * as employeeService from '@services/employeeService'



interface EmployeeFilters {

  name: string

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

  lastFetchEmployees: number

  employeesRevision: number

  exportSnapshot: Employee[] | null

  exportSnapshotKey: string | null

  setFilters: (f: Partial<EmployeeFilters>) => void

  setSort: (column: string, direction: 'asc' | 'desc') => void

  setPage: (page: number) => void

  setPageSize: (pageSize: number) => void

  fetchEmployees: () => Promise<void>

  fetchEmployeesSilent: () => Promise<void>

  getEmployeesForExport: () => Promise<Employee[]>

  setSelected: (e: Employee | null) => void

  applyEmployeeRecord: (employee: Employee) => void

  addEmployee: (payload: Omit<Employee, 'id'>) => Promise<Employee>

  updateEmployee: (id: string, payload: Partial<Employee>, changedBy?: string) => Promise<Employee>

  deleteEmployee: (id: string) => Promise<void>

  updateEmployeeStatus: (

    id: string,

    status: Employee['status'],

    reason?: string,

    changedBy?: string,

  ) => Promise<void>

  bulkUpdateStatus: (

    ids: string[],

    status: Employee['status'],

    reason: string,

    changedBy?: string,

  ) => Promise<{ updated: number }>

}



// Cache expiry time in milliseconds (30 seconds)

const CACHE_EXPIRY = 30000



let employeesFetchSeq = 0



function buildExportSnapshotKey(

  filters: EmployeeFilters,

  sort: { column: string; direction: 'asc' | 'desc' },

): string {

  return JSON.stringify({

    name: filters.name,

    employmentType: filters.employmentType,

    status: filters.status,

    sortColumn: sort.column,

    sortDirection: sort.direction,

  })

}



function mergeEmployeeRecord(existing: Employee, updated: Employee): Employee {

  return { ...existing, ...updated }

}



function bumpEmployeeCaches(

  set: (

    partial:

      | Partial<EmployeeState>

      | ((state: EmployeeState) => Partial<EmployeeState>),

  ) => void,

) {

  set((state) => ({

    employeesRevision: state.employeesRevision + 1,

    lastFetchEmployees: 0,

    exportSnapshot: null,

    exportSnapshotKey: null,

  }))

}



export const useEmployeeStore = create<EmployeeState>((set, get) => ({

  employees: [],

  selectedEmployee: null,

  filters: { name: '', employmentType: 'all', status: 'all' },

  pagination: { page: 1, pageSize: 10, total: 0 },

  sort: { column: 'joinedAt', direction: 'desc' },

  loading: false,

  lastFetchEmployees: 0,

  employeesRevision: 0,

  exportSnapshot: null,

  exportSnapshotKey: null,

  setFilters: (f) =>

    set({

      filters: { ...get().filters, ...f },

      pagination: { ...get().pagination, page: 1 },

      exportSnapshot: null,

      exportSnapshotKey: null,

    }),

  setSort: (column, direction) =>

    set({

      sort: { column, direction },

      pagination: { ...get().pagination, page: 1 },

      exportSnapshot: null,

      exportSnapshotKey: null,

    }),

  setPage: (page) => set({ pagination: { ...get().pagination, page } }),

  setPageSize: (pageSize) =>

    set({ pagination: { ...get().pagination, pageSize, page: 1 }, exportSnapshot: null, exportSnapshotKey: null }),

  fetchEmployees: async () => {

    const seq = ++employeesFetchSeq

    set({ loading: true })

    const { filters, pagination, sort } = get()

    try {

      const res = await employeeService.getEmployees({

        name: filters.name || undefined,

        employmentType: filters.employmentType,

        status: filters.status,

        sortColumn: sort.column,

        sortDirection: sort.direction,

        page: pagination.page,

        pageSize: pagination.pageSize,

      })

      if (seq !== employeesFetchSeq) return

      set({

        employees: res.data,

        pagination: { ...pagination, total: res.total },

        loading: false,

        lastFetchEmployees: Date.now(),

      })

    } catch (err) {

      if (seq !== employeesFetchSeq) return

      set({ loading: false })

      const message =

        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??

        (err as { message?: string })?.message ??

        'Failed to load employees'

      toast.error(message)

    }

  },

  fetchEmployeesSilent: async () => {

    const now = Date.now()

    if (now - get().lastFetchEmployees < CACHE_EXPIRY) {

      return

    }

    const seq = ++employeesFetchSeq

    const { filters, pagination, sort } = get()

    try {

      const res = await employeeService.getEmployees({

        name: filters.name || undefined,

        employmentType: filters.employmentType,

        status: filters.status,

        sortColumn: sort.column,

        sortDirection: sort.direction,

        page: pagination.page,

        pageSize: pagination.pageSize,

      })

      if (seq !== employeesFetchSeq) return

      set({

        employees: res.data,

        pagination: { ...pagination, total: res.total },

        lastFetchEmployees: now,

      })

    } catch {

      // silently fail on background polling

    }

  },

  getEmployeesForExport: async () => {

    const { filters, pagination, sort, employees, exportSnapshot, exportSnapshotKey } = get()

    const key = buildExportSnapshotKey(filters, sort)



    if (exportSnapshot && exportSnapshotKey === key) {

      return exportSnapshot

    }



    if (pagination.total === 0) {

      return []

    }



    if (pagination.total <= pagination.pageSize && employees.length === pagination.total) {

      set({ exportSnapshot: employees, exportSnapshotKey: key })

      return employees

    }



    const res = await employeeService.getEmployees({

      name: filters.name || undefined,

      employmentType: filters.employmentType,

      status: filters.status,

      sortColumn: sort.column,

      sortDirection: sort.direction,

      page: 1,

      pageSize: Math.min(pagination.total, 1000),

    })



    set({ exportSnapshot: res.data, exportSnapshotKey: key })

    return res.data

  },

  setSelected: (selectedEmployee) => set({ selectedEmployee }),

  applyEmployeeRecord: (employee) => {

    set((state) => ({

      employees: state.employees.map((e) =>

        e.id === employee.id ? mergeEmployeeRecord(e, employee) : e,

      ),

      selectedEmployee:

        state.selectedEmployee?.id === employee.id

          ? mergeEmployeeRecord(state.selectedEmployee, employee)

          : state.selectedEmployee,

      employeesRevision: state.employeesRevision + 1,

      lastFetchEmployees: 0,

      exportSnapshot: null,

      exportSnapshotKey: null,

    }))

  },

  addEmployee: async (payload) => {

    const employee = await employeeService.createEmployee(payload)

    bumpEmployeeCaches(set)

    await get().fetchEmployees()

    return employee

  },

  updateEmployee: async (id, payload, changedBy) => {

    const updated = await employeeService.updateEmployee(id, payload, changedBy)

    get().applyEmployeeRecord(updated)

    await get().fetchEmployees()

    return updated

  },

  deleteEmployee: async (id) => {

    await employeeService.deleteEmployee(id)

    bumpEmployeeCaches(set)

    await get().fetchEmployees()

  },

  updateEmployeeStatus: async (id, status, reason, changedBy) => {

    const updated = await employeeService.updateEmployeeStatus(id, status, reason, changedBy)

    get().applyEmployeeRecord(updated)

    await get().fetchEmployees()

  },

  bulkUpdateStatus: async (ids, status, reason, changedBy) => {

    const result = await employeeService.bulkUpdateStatus(ids, status, reason, changedBy)

    bumpEmployeeCaches(set)

    await get().fetchEmployees()

    return result

  },

}))

