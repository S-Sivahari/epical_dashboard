import { create } from 'zustand'
import api from '@services/api'

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
  isAuthenticated: boolean
  role: UserRole | null
  isHydrated: boolean
  login: (email: string, password: string) => Promise<void>
  hydrateSession: () => Promise<void>
  applySession: (user: AuthUser, role: string) => void
  logout: () => Promise<void>
  patchUser: (partial: Partial<AuthUser>) => void
}

function clearLegacyAuthStorage(): void {
  localStorage.removeItem('hrms_token')
  localStorage.removeItem('hrms_role')
  localStorage.removeItem('hrms_user')
}

function mapApiRole(role: string): UserRole {
  return role === 'admin' ? 'admin' : 'employee'
}

function mapUserRole(role: UserRole): AuthUser['role'] {
  return role === 'admin' ? 'Admin' : 'Employee'
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  role: null,
  isAuthenticated: false,
  isHydrated: false,

  applySession: (user, role) => {
    const mappedRole = mapApiRole(role)
    set({
      user: { ...user, role: mapUserRole(mappedRole) },
      role: mappedRole,
      isAuthenticated: true,
    })
  },

  hydrateSession: async () => {
    clearLegacyAuthStorage()
    try {
      const { data } = await api.get<{ user: AuthUser; role: string }>('/auth/me')
      get().applySession(data.user, data.role)
    } catch {
      if (!get().isAuthenticated) {
        set({ user: null, role: null, isAuthenticated: false })
      }
    } finally {
      set({ isHydrated: true })
    }
  },

  login: async (email, password) => {
    const { data } = await api.post<{ user: AuthUser; role: string }>('/auth/login', {
      email,
      password,
    })
    get().applySession(data.user, data.role)
  },

  logout: async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* clear client state even if network fails */
    }
    set({ user: null, role: null, isAuthenticated: false })
  },

  patchUser: (partial) => {
    set((state) => {
      if (!state.user) return state
      return { user: { ...state.user, ...partial } }
    })
  },
}))
