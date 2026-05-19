import { create } from 'zustand'

export type UserRole = 'admin' | 'employee'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'Admin' | 'Employee'
  department: string
  designation: string
  joinedAt: string
  avatarUrl?: string
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  role: UserRole | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const storedToken = localStorage.getItem('hrms_token')
const storedRole = localStorage.getItem('hrms_role') as UserRole | null

const adminUser: AuthUser = {
  id: 'ADM-1',
  name: 'Priya Nair',
  email: 'admin@company.com',
  role: 'Admin',
  department: 'People',
  designation: 'HR Director',
  joinedAt: '2019-04-01',
}

const employeeUser: AuthUser = {
  id: 'EMP-2024-0847',
  name: 'Sarah Mitchell',
  email: 'employee@company.com',
  role: 'Employee',
  department: 'Design & Experience',
  designation: 'Senior Product Designer',
  joinedAt: '2021-03-15',
  avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
}

const adminCredentials = { email: 'admin@company.com', password: 'admin123' }
const employeeCredentials = { email: 'employee@company.com', password: 'employee123' }

export const useAuthStore = create<AuthState>((set) => ({
  user:
    storedToken && storedRole === 'admin'
      ? adminUser
      : storedToken && storedRole === 'employee'
        ? employeeUser
        : null,
  token: storedToken,
  role: storedRole,
  isAuthenticated: !!storedToken,
  login: async (email, password) => {
    let role: UserRole | null = null
    let user: AuthUser | null = null

    if (email === adminCredentials.email && password === adminCredentials.password) {
      role = 'admin'
      user = adminUser
    }
    if (email === employeeCredentials.email && password === employeeCredentials.password) {
      role = 'employee'
      user = employeeUser
    }

    if (!role || !user) {
      throw new Error('Invalid credentials')
    }

    const token = `demo-token-${Date.now()}`
    localStorage.setItem('hrms_token', token)
    localStorage.setItem('hrms_role', role)
    set({ token, isAuthenticated: true, user, role })
  },
  logout: () => {
    localStorage.removeItem('hrms_token')
    localStorage.removeItem('hrms_role')
    set({ user: null, token: null, isAuthenticated: false, role: null })
  },
}))
