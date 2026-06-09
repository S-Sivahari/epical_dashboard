import { Navigate, Route, Routes } from 'react-router-dom'
import { MetalRoutingLayout } from '@layouts/MetalRoutingLayout'
import { PdkDashboardPage } from '@pages/shared/pdk/PdkDashboardPage'
import { PdkModulesPage } from '@pages/shared/pdk/PdkModulesPage'
import { CellRoutingProjectsPage } from '@pages/shared/pdk/CellRoutingProjectsPage'
import { ProjectCellRoutingPage } from '@pages/shared/pdk/ProjectCellRoutingPage'

const BASE = '/admin/metal-routing'

export function AdminMetalRoutingPage() {
  return (
    <div
      className="metal-routing-view crewiq-dashboard relative z-10 flex min-h-0 flex-1 flex-col font-body"
      data-metal-routing
    >
      <MetalRoutingLayout basePath={BASE}>
        <Routes>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<PdkDashboardPage basePath={BASE} />} />
          <Route path="pdk-modules" element={<PdkModulesPage />} />
          <Route path="cell-routing" element={<CellRoutingProjectsPage basePath={BASE} />} />
          <Route path="cell-routing/:projectId" element={<ProjectCellRoutingPage basePath={BASE} />} />
        </Routes>
      </MetalRoutingLayout>
    </div>
  )
}
