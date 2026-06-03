/**
 * API base URL for axios (Vite proxy in dev).
 * Google OAuth uses getGoogleOAuthStartUrl() — must match backend GOOGLE_CALLBACK_URL host.
 */
export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  if (import.meta.env.DEV) return '/api'
  return 'http://localhost:3000/api'
}

/** Backend origin (port 3000) — matches Google Console redirect URI host. */
export function getApiOrigin(): string {
  const explicit = import.meta.env.VITE_API_ORIGIN?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const base = getApiBaseUrl()
  if (base.startsWith('http')) {
    return base.replace(/\/api\/?$/, '')
  }
  return 'http://localhost:3000'
}

/** Start Google OAuth on the API host, not the Vite dev URL. */
export function getGoogleOAuthStartUrl(): string {
  return `${getApiOrigin()}/api/auth/google`
}
