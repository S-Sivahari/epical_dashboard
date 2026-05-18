import { create } from 'zustand'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  department: string
  designation: string
  joinedAt: string
  avatarUrl?: string
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  login: async (email, _password) => {
    const token = `demo-token-${Date.now()}`
    localStorage.setItem('hrms_token', token)
    set({
      token,
      isAuthenticated: true,
      user: {
        id: 'ADM-1',
        name: 'Priya Nair',
        email,
        role: 'Admin',
        department: 'People',
        designation: 'HR Director',
        joinedAt: '2019-04-01',
      },
    })
  },
  logout: () => {
    localStorage.removeItem('hrms_token')
    set({ user: null, token: null, isAuthenticated: false })
  },
}))
