import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore, type UserRole } from '@store/authStore'

interface ProtectedRouteProps {
  roles?: UserRole[]
}

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const role = useAuthStore((s) => s.role)
  const location = useLocation()

  if (!isHydrated) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />
  }

  if (roles?.length) {
    if (!role) {
      return null
    }
    if (!roles.includes(role)) {
      return <Navigate to={role === 'admin' ? '/admin' : '/employee'} replace />
    }
  }

  return <Outlet />
}
