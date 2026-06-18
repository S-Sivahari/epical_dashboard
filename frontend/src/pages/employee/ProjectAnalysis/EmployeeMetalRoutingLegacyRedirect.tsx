import { Navigate, useLocation } from 'react-router-dom'
import { ROUTES } from '@constants/routes'

/** Preserve deep links when migrating from /employee/metal-routing to project-analysis. */
export function EmployeeMetalRoutingLegacyRedirect() {
  const { pathname } = useLocation()
  const suffix = pathname.replace(/^\/employee\/metal-routing\/?/, '')
  const target = suffix
    ? `${ROUTES.EMPLOYEE_PROJECT_ANALYSIS_SIGNAL}/${suffix}`
    : ROUTES.EMPLOYEE_PROJECT_ANALYSIS_SIGNAL
  return <Navigate to={target} replace />
}
