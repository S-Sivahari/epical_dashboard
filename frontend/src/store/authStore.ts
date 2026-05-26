import { create } from 'zustand'
import { jwtDecode } from 'jwt-decode'
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
  completeOAuthRedirect: (payload: {
    token: string
    role: string
    email: string
    name: string
    designation?: string
  }) => void
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
  completeOAuthRedirect: ({ token, role, email, name, designation }) => {
    const mappedRole: UserRole = role === 'admin' ? 'admin' : 'employee'
    let userId = email
    try {
      const decoded = jwtDecode<{ id?: string }>(token)
      if (decoded.id) userId = decoded.id
    } catch {
      // keep email fallback
    }

    const user: AuthUser = {
      id: userId,
      name: name || email.split('@')[0],
      email,
      role: mappedRole === 'admin' ? 'Admin' : 'Employee',
      designation: designation || (mappedRole === 'admin' ? 'Admin' : 'Employee'),
      joinedAt: new Date().toISOString().slice(0, 10),
    }

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
