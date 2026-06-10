import { Navigate, Route, Routes } from 'react-router-dom'
import { MetalRoutingLayout } from '@layouts/MetalRoutingLayout'
import { PdkDashboardPage } from '@pages/shared/pdk/PdkDashboardPage'
import { PdkModulesPage } from '@pages/shared/pdk/PdkModulesPage'
import { CellRoutingProjectsPage } from '@pages/shared/pdk/CellRoutingProjectsPage'
import { ProjectCellRoutingPage } from '@pages/shared/pdk/ProjectCellRoutingPage'

const BASE = '/employee/metal-routing'

export function EmployeeMetalRoutingPage() {
  return (
    <div className="metal-routing-view relative flex min-h-0 flex-1 flex-col" data-metal-routing>
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
