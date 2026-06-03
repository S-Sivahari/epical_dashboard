import axios from 'axios'
import { getApiBaseUrl } from '@/config/apiBase'

const api = axios.create({
  baseURL: getApiBaseUrl(),
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
          window.location.assign('/auth/login')
        }
      }
    }
    return Promise.reject(err)
  },
)

export default api
