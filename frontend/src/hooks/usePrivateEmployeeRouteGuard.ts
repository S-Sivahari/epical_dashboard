import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { isPrivateEmployeeRoute } from '@/utils/employeeView'
import { useEmployeePortalView } from '@hooks/useEmployeePortalView'

/** Redirect private-view employees away from projects, leave, and calendar routes. */
export function usePrivateEmployeeRouteGuard() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { isPrivate, loading } = useEmployeePortalView()

  useEffect(() => {
    if (loading || !isPrivate || !isPrivateEmployeeRoute(pathname)) return
    navigate('/employee', { replace: true })
  }, [isPrivate, loading, navigate, pathname])
}
