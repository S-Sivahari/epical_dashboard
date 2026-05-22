import { toast } from 'sonner'
import axios from 'axios'
import { toast } from 'sonner'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api',
  timeout: 15000,
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hrms_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRedirecting = false

api.interceptors.response.use(
  (res) => res,
  (err: { response?: { status?: number }; config?: { url?: string } }) => {
    const status = err.response?.status
    if (status === 401) {
      // Don't redirect if this is a login request itself
      const url = err.config?.url ?? ''
      if (url.includes('/auth/login')) {
        return Promise.reject(err)
      }

      localStorage.removeItem('hrms_token')
      localStorage.removeItem('hrms_role')
      localStorage.removeItem('hrms_user')

      // Only redirect once to avoid multiple redirects from parallel API calls
      if (!isRedirecting && window.location.pathname.startsWith('/admin')) {
        isRedirecting = true
        toast.error('Session expired. Please sign in again.')
        window.location.assign('/auth/login')
      }
    } else if (status && status >= 500) {
      toast.error('Server error. Please try again later.')
    }
    return Promise.reject(err)
  },
)

export default api
