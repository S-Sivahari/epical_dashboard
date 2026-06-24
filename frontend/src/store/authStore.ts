import { create } from 'zustand'
import api from '@services/api'

export type UserRole = 'admin' | 'employee'
export type PortalTarget = UserRole

export interface AuthUser {
  id: string
  name: string
  /** Separate display name shown only on the admin portal. */
  adminDisplayName?: string
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
  portalAdmin: boolean
  isHydrated: boolean
  login: (email: string, password: string) => Promise<void>
  hydrateSession: () => Promise<void>
  applySession: (user: AuthUser, role: string, portalAdmin?: boolean) => void
  switchPortal: (target: PortalTarget) => Promise<void>
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
  portalAdmin: false,
  isAuthenticated: false,
  isHydrated: false,

  applySession: (user, role, portalAdmin = false) => {
    const mappedRole = mapApiRole(role)
    set({
      user: { ...user, role: mapUserRole(mappedRole) },
      role: mappedRole,
      portalAdmin: Boolean(portalAdmin),
      isAuthenticated: true,
    })
  },

  hydrateSession: async () => {
    clearLegacyAuthStorage()
    try {
      const { data } = await api.get<{ user: AuthUser; role: string; portalAdmin?: boolean }>('/auth/me')
      get().applySession(data.user, data.role, data.portalAdmin)
    } catch {
      set({ user: null, role: null, portalAdmin: false, isAuthenticated: false })
    } finally {
      set({ isHydrated: true })
    }
  },

  login: async (email, password) => {
    const { data } = await api.post<{ user: AuthUser; role: string; portalAdmin?: boolean }>('/auth/login', {
      email,
      password,
    })
    get().applySession(data.user, data.role, data.portalAdmin)
  },

  switchPortal: async (target) => {
    const { data } = await api.post<{ user: AuthUser; role: string; portalAdmin?: boolean }>(
      '/auth/switch-portal',
      { portal: target },
    )
    get().applySession(data.user, data.role, data.portalAdmin)
  },

  logout: async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* clear client state even if network fails */
    }
    set({ user: null, role: null, portalAdmin: false, isAuthenticated: false })
  },

  patchUser: (partial) => {
    set((state) => {
      if (!state.user) return state
      return { user: { ...state.user, ...partial } }
    })
  },
}))

export function getDefaultPortalPath(role: UserRole | null): '/admin' | '/employee' {
  return role === 'admin' ? '/admin' : '/employee'
}

/** True when the session JWT is on the admin portal (env admin or Employee+Admin after switching). */
export function hasActiveAdminPortal(role: UserRole | null): boolean {
  return role === 'admin'
}
