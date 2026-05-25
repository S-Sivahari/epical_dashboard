import { create } from 'zustand'
import api from '@services/api'
import { verifyGoogleOAuthLogin } from '@services/googleOAuthService'

export type UserRole = 'admin' | 'employee'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'Admin' | 'Employee'
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
  loginWithOAuth: (email: string, name: string, googleId: string) => Promise<void>
  logout: () => void
}

const storedToken = localStorage.getItem('hrms_token')
const storedRole = localStorage.getItem('hrms_role') as UserRole | null
const storedUser = localStorage.getItem('hrms_user')

function parseStoredUser(): AuthUser | null {
  if (!storedUser) return null
  try {
    return JSON.parse(storedUser) as AuthUser
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: storedToken ? parseStoredUser() : null,
  token: storedToken,
  role: storedRole,
  isAuthenticated: !!storedToken,
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password })
    const { token, user, role } = response.data as {
      token: string
      user: AuthUser
      role: string
    }

    const mappedRole: UserRole = role === 'admin' ? 'admin' : 'employee'

    localStorage.setItem('hrms_token', token)
    localStorage.setItem('hrms_role', mappedRole)
    localStorage.setItem('hrms_user', JSON.stringify(user))
    set({ token, isAuthenticated: true, user, role: mappedRole })
  },
  loginWithOAuth: async (email, name, googleId) => {
    const response = await verifyGoogleOAuthLogin({ email, name, googleId })
    const { token, user, role } = response as {
      token: string
      user: AuthUser
      role: string
    }

    const mappedRole: UserRole = role === 'admin' ? 'admin' : 'employee'

    localStorage.setItem('hrms_token', token)
    localStorage.setItem('hrms_role', mappedRole)
    localStorage.setItem('hrms_user', JSON.stringify(user))
    set({ token, isAuthenticated: true, user, role: mappedRole })
  },
  logout: () => {
    localStorage.removeItem('hrms_token')
    localStorage.removeItem('hrms_role')
    localStorage.removeItem('hrms_user')
    set({ user: null, token: null, isAuthenticated: false, role: null })
  },
}))
