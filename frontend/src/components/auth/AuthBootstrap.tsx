import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@store/authStore'
import { PageLoading } from '@components/layout/PageLoading'
import { prefetchGoogleAuthConfig } from '@/utils/googleAuthConfig'

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const hydrateSession = useAuthStore((s) => s.hydrateSession)
  const isPublicAuthRoute = location.pathname.startsWith('/auth')

  useEffect(() => {
    void hydrateSession()
    void prefetchGoogleAuthConfig()
  }, [hydrateSession])

  if (!isHydrated && !isPublicAuthRoute) {
    return <PageLoading />
  }

  return <>{children}</>
}
