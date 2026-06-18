import { MetalRoutingRoutes } from '@pages/shared/pdk/MetalRoutingRoutes'
import { ROUTES } from '@constants/routes'

const BASE = ROUTES.PROJECT_ANALYSIS_SIGNAL

export function ProjectAnalysisSignalPage() {
  return <MetalRoutingRoutes basePath={BASE} />
}
