import { useEffect } from 'react'
import { useAuthStore } from '@store/authStore'

/** Refresh the signed-in employee session so header/profile chrome reflects admin edits. */
export function EmployeeAuthProfileSync() {
  const hydrateSession = useAuthStore((s) => s.hydrateSession)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const role = useAuthStore((s) => s.role)

  useEffect(() => {
    if (!isAuthenticated || role !== 'employee') return undefined

    const refresh = () => {
      void hydrateSession()
    }

    refresh()

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [hydrateSession, isAuthenticated, role])

  return null
}
