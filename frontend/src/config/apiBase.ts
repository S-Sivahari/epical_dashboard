/**
 * API base URL for axios (Vite proxy in dev).
 * Google OAuth uses getGoogleOAuthStartUrl() — must match backend GOOGLE_CALLBACK_URL host.
 */
export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  return '/api'
}

/** Backend origin — must match Google Console redirect URI host. */
export function getApiOrigin(): string {
  const explicit = import.meta.env.VITE_API_ORIGIN?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const base = getApiBaseUrl()
  if (base.startsWith('http')) {
    return base.replace(/\/api\/?$/, '')
  }
  // Same-origin deploy (Cloud Run): API is served from the current host.
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return import.meta.env.DEV ? 'http://localhost:3000' : ''
}

/** Start Google OAuth on the API host (prefer oauthStartUrl from /auth/google/config). */
export function getGoogleOAuthStartUrl(): string {
  const origin = getApiOrigin()
  if (!origin) return '/api/auth/google'
  return `${origin}/api/auth/google`
}
