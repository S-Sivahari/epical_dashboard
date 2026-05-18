import axios from 'axios'
import { toast } from 'sonner'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hrms_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err: { response?: { status?: number } }) => {
    const status = err.response?.status
    if (status === 401) {
      localStorage.removeItem('hrms_token')
      localStorage.removeItem('hrms_role')
      if (!window.location.pathname.startsWith('/admin')) {
        return Promise.reject(err)
      }
      window.location.assign('/auth/login')
      toast.error('Session expired. Please sign in again.')
    } else if (status && status >= 500) {
      toast.error('Server error. Please try again later.')
    }
    return Promise.reject(err)
  },
)

export default api
