import axios from 'axios'
import { toast } from 'sonner'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api',
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

/** Optional endpoints — a 401 here must not wipe the whole session (e.g. missing profile photo). */
const OPTIONAL_AUTH_PATHS = [
  '/employees',
  '/photo',
  '/documents/',
]

function isOptionalAuthRequest(url: string): boolean {
  return OPTIONAL_AUTH_PATHS.some((fragment) => url.includes(fragment))
}

function isProtectedAppRoute(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname.startsWith('/employee')
}

api.interceptors.response.use(
  (res) => res,
  (err: { response?: { status?: number; data?: { error?: string } }; config?: { url?: string; headers?: { Authorization?: string } } }) => {
    const status = err.response?.status
    const url = err.config?.url ?? ''
    const hadAuth = Boolean(err.config?.headers?.Authorization)

    if (status === 401) {
      if (url.includes('/auth/login')) {
        return Promise.reject(err)
      }

      // Missing profile photo / optional asset — never wipe the session
      if (isOptionalAuthRequest(url)) {
        return Promise.reject(err)
      }

      // Only clear session when we sent a token and the server rejected it (expired/invalid)
      if (hadAuth) {
        localStorage.removeItem('hrms_token')
        localStorage.removeItem('hrms_role')
        localStorage.removeItem('hrms_user')

        const pathname = window.location.pathname
        if (!isRedirecting && isProtectedAppRoute(pathname)) {
          isRedirecting = true
          toast.error('Session expired. Please sign in again.')
          window.location.assign('/auth/login')
        }
      }
    } else if (status && status >= 500) {
      if (!isOptionalAuthRequest(url)) {
        toast.error('Server error. Please try again later.')
      }
    } else if (status === 403) {
      const message = err.response?.data?.error || 'You do not have permission for this action.'
      toast.error(message)
    } else if (status === 409) {
      const message = err.response?.data?.error || 'Request could not be completed.'
      toast.error(message)
    }
    return Promise.reject(err)
  },
)

export default api
