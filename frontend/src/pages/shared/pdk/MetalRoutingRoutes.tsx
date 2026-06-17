import { Navigate, Route, Routes } from 'react-router-dom'

import { ProjectSignalAnalysisLayout } from '@layouts/ProjectSignalAnalysisLayout'

import { SignalAnalysisProjectsPage } from '@pages/shared/pdk/SignalAnalysisProjectsPage'
import { SignalAnalysisPdkModulesPage } from '@pages/shared/pdk/SignalAnalysisPdkModulesPage'
import { ProjectPdkSelectionPage } from '@pages/shared/pdk/ProjectPdkSelectionPage'
import { ProjectSignalAnalysisPage } from '@pages/shared/pdk/ProjectSignalAnalysisPage'
import { ProjectCellRoutingPage } from '@pages/shared/pdk/ProjectCellRoutingPage'

export const METAL_ROUTING_VIEW_CLASS =
  'metal-routing-view relative z-10 flex min-h-0 flex-1 flex-col font-body'

export function MetalRoutingRoutes({ basePath }: { basePath: string }) {
  const hideSignalProjectsHeader = basePath.includes('/project-analysis')
  const usePremiumProjectsLayout =
    hideSignalProjectsHeader
    || basePath.includes('/employee/metal-routing')
    || basePath.includes('/admin/metal-routing')

  return (
    <div className={METAL_ROUTING_VIEW_CLASS} data-metal-routing>
      <Routes>
        <Route
          index
          element={
            <SignalAnalysisProjectsPage
              basePath={basePath}
              hidePageHeader={hideSignalProjectsHeader}
              premiumLayout={usePremiumProjectsLayout}
            />
          }
        />

        <Route path="pdk-modules" element={<SignalAnalysisPdkModulesPage basePath={basePath} />} />

        <Route path="projects/:projectId" element={<ProjectSignalAnalysisLayout basePath={basePath} />}>
          <Route index element={<Navigate to="pdk-selection" replace />} />
          <Route path="pdk-selection" element={<ProjectPdkSelectionPage />} />
          <Route path="signal-analysis" element={<ProjectSignalAnalysisPage basePath={basePath} />} />
          <Route path="signal-analysis/route" element={<ProjectCellRoutingPage basePath={basePath} />} />
        </Route>
      </Routes>
    </div>
  )
}
