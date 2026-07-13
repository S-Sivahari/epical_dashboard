import { useEffect } from 'react'
import { useAuthStore } from '@store/authStore'
import { PageLoading } from '@components/layout/PageLoading'
import { prefetchGoogleAuthConfig } from '@/utils/googleAuthConfig'

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const hydrateSession = useAuthStore((s) => s.hydrateSession)

  useEffect(() => {
    void hydrateSession()
    void prefetchGoogleAuthConfig()
  }, [hydrateSession])

  if (!isHydrated) {
    return <PageLoading />
  }

  return <>{children}</>
}
