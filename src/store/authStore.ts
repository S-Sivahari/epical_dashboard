import { create } from 'zustand'
import api from '@services/api'

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
  hydrate: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  login: async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password })
      const { token, user } = response.data
      
      if (!token) {
        throw new Error('No token received from server')
      }
      
      localStorage.setItem('hrms_token', token)
      localStorage.setItem('hrms_user', JSON.stringify(user))
      set({
        token,
        isAuthenticated: true,
        user,
      })
    } catch (error: any) {
      localStorage.removeItem('hrms_token')
      localStorage.removeItem('hrms_user')
      set({ user: null, token: null, isAuthenticated: false })
      throw new Error(error.response?.data?.error || error.message || 'Login failed')
    }
  },
  logout: () => {
    localStorage.removeItem('hrms_token')
    localStorage.removeItem('hrms_user')
    set({ user: null, token: null, isAuthenticated: false })
  },
  hydrate: () => {
    const token = localStorage.getItem('hrms_token')
    const userStr = localStorage.getItem('hrms_user')
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr)
        set({ token, isAuthenticated: true, user })
      } catch {
        localStorage.removeItem('hrms_token')
        localStorage.removeItem('hrms_user')
        set({ user: null, token: null, isAuthenticated: false })
      }
    }
  },
}))
