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
  // Dev: Vite serves the UI on :5173 but API lives on :3000 (proxy only applies to fetch/axios).
  if (import.meta.env.DEV) {
    return 'http://localhost:3000'
  }
  // Production same-origin deploy (Cloud Run): API is served from the current host.
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return ''
}

/** Start Google OAuth on the API host (prefer oauthStartUrl from /auth/google/config). */
export function getGoogleOAuthStartUrl(): string {
  const origin = getApiOrigin()
  if (!origin) return '/api/auth/google'
  return `${origin}/api/auth/google`
}
