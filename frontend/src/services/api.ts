import axios from 'axios'
import { getApiBaseUrl } from '@/config/apiBase'

const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
})

function readCsrfToken(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)hrms_csrf=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

api.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toLowerCase()
  if (!['get', 'head', 'options'].includes(method)) {
    const csrf = readCsrfToken()
    if (csrf) {
      config.headers.set('X-CSRF-Token', csrf)
    }
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
  (err: { response?: { status?: number }; config?: { url?: string } }) => {
    const status = err.response?.status
    const url = err.config?.url ?? ''

    if (status === 401) {
      if (url.includes('/auth/login') || url.includes('/auth/me')) {
        return Promise.reject(err)
      }

      if (isOptionalAuthRequest(url)) {
        return Promise.reject(err)
      }

      const pathname = window.location.pathname
      if (!isRedirecting && isProtectedAppRoute(pathname)) {
        isRedirecting = true
        import('@store/authStore').then(({ useAuthStore }) => {
          const { isHydrated } = useAuthStore.getState()
          if (!isHydrated) {
            isRedirecting = false
            return
          }
          useAuthStore.setState({
            user: null,
            role: null,
            isAuthenticated: false,
          })
          window.location.assign('/auth/login')
        })
      }
    }
    return Promise.reject(err)
  },
)

export default api
