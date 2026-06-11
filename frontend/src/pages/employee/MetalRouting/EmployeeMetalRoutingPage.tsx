import { Navigate, Route, Routes } from 'react-router-dom'

import { ProjectSignalAnalysisLayout } from '@layouts/ProjectSignalAnalysisLayout'

import { SignalAnalysisProjectsPage } from '@pages/shared/pdk/SignalAnalysisProjectsPage'

import { SignalAnalysisPdkModulesPage } from '@pages/shared/pdk/SignalAnalysisPdkModulesPage'

import { ProjectPdkSelectionPage } from '@pages/shared/pdk/ProjectPdkSelectionPage'

import { ProjectSignalAnalysisPage } from '@pages/shared/pdk/ProjectSignalAnalysisPage'

import { ProjectCellRoutingPage } from '@pages/shared/pdk/ProjectCellRoutingPage'



const BASE = '/employee/metal-routing'



export function EmployeeMetalRoutingPage() {

  return (

    <div className="metal-routing-view relative flex min-h-0 flex-1 flex-col" data-metal-routing>

      <Routes>

        <Route index element={<SignalAnalysisProjectsPage basePath={BASE} />} />

        <Route path="pdk-modules" element={<SignalAnalysisPdkModulesPage basePath={BASE} />} />

        <Route path="projects/:projectId" element={<ProjectSignalAnalysisLayout basePath={BASE} />}>

          <Route index element={<Navigate to="signal-analysis" replace />} />

          <Route path="pdk-selection" element={<ProjectPdkSelectionPage />} />

          <Route path="signal-analysis" element={<ProjectSignalAnalysisPage basePath={BASE} />} />

          <Route path="signal-analysis/route" element={<ProjectCellRoutingPage basePath={BASE} />} />

        </Route>

      </Routes>

    </div>

  )

}


