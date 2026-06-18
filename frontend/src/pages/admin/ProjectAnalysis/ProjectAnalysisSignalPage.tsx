import { useLocation } from 'react-router-dom'
import { ROUTES } from '@constants/routes'
import { MetalRoutingRoutes } from '@pages/shared/pdk/MetalRoutingRoutes'

export function ProjectAnalysisSignalPage() {
  const { pathname } = useLocation()
  const base = pathname.startsWith(ROUTES.EMPLOYEE_PROJECT_ANALYSIS)
    ? ROUTES.EMPLOYEE_PROJECT_ANALYSIS_SIGNAL
    : ROUTES.PROJECT_ANALYSIS_SIGNAL

  return <MetalRoutingRoutes basePath={base} />
}
