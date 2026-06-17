import { getApiBaseUrl } from '@/config/apiBase'

export type GoogleOAuthConfig = {
  enabled?: boolean
  redirectUri?: string
  oauthStartUrl?: string
}

let configPromise: Promise<GoogleOAuthConfig | null> | null = null

/** Shared, cached fetch — kick off from AuthBootstrap so login layout is ready sooner. */
export function prefetchGoogleAuthConfig(): Promise<GoogleOAuthConfig | null> {
  if (!configPromise) {
    configPromise = fetch(`${getApiBaseUrl()}/auth/google/config`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
  }
  return configPromise
}
