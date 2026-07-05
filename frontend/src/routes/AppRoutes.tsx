import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ROUTES } from '@constants/routes'

import { PageLoading } from '@components/layout/PageLoading'

import { AuthLayout } from '@layouts/AuthLayout'
import { AdminLayout } from '@layouts/AdminLayout'
import { EmployeeLayout } from '@layouts/EmployeeLayout'

import { ProtectedRoute } from '@routes/ProtectedRoute'
import { useAuthStore } from '@store/authStore'
import { LoginPage } from '@pages/auth/LoginPage'

// ── Admin Pages ───────────────────────────────────────────────
const DashboardHome = lazy(async () => {
  const m = await import('@pages/admin/Dashboard/DashboardHome')
  return { default: m.DashboardHome }
})

const EmployeeList = lazy(async () => {
  const m = await import('@pages/admin/Employees/EmployeeList')
  return { default: m.EmployeeList }
})

const AddEmployee = lazy(async () => {
  const m = await import('@pages/admin/Employees/AddEmployee')
  return { default: m.AddEmployee }
})

const EmployeeProfile = lazy(async () => {
  const m = await import('@pages/admin/Employees/EmployeeProfile')
  return { default: m.EmployeeProfile }
})

const EditEmployee = lazy(async () => {
  const m = await import('@pages/admin/Employees/EditEmployee')
  return { default: m.EditEmployee }
})

const LeaveManagementDashboard = lazy(async () => {
  const m = await import('@pages/admin/Leaves/LeaveManagementDashboard')
  return { default: m.LeaveManagementDashboard }
})

const ProjectManagement = lazy(async () => {
  const m = await import('@pages/admin/Projects/ProjectManagement')
  return { default: m.ProjectManagement }
})

const AdminProjectsPage = lazy(async () => {
  const m = await import('@pages/admin/Projects/AdminProjectsPage')
  return { default: m.AdminProjectsPage }
})

const ProjectWorkspace = lazy(async () => {
  const m = await import('@pages/admin/Projects/ProjectWorkspace')
  return { default: m.ProjectWorkspace }
})

const ProjectCellPage = lazy(async () => {
  const m = await import('@pages/admin/Projects/ProjectCellPage')
  return { default: m.ProjectCellPage }
})

const AdminCompanyCalendarPage = lazy(() =>
  import('@pages/admin/Calendar/AdminCompanyCalendarPage')
)

const TrainingCourses = lazy(async () => {
  const m = await import('@pages/admin/Training/TrainingCourses')
  return { default: m.TrainingCourses }
})

const CompanyAchievements = lazy(async () => {
  const m = await import('@pages/admin/Achievements/CompanyAchievements')
  return { default: m.CompanyAchievements }
})

const DocumentManagement = lazy(async () => {
  const m = await import('@pages/admin/Documents/DocumentManagement')
  return { default: m.DocumentManagement }
})

const CompanyNews = lazy(async () => {
  const m = await import('@pages/admin/News/CompanyNews')
  return { default: m.CompanyNews }
})

const TicketManagement = lazy(async () => {
  const m = await import('@pages/admin/Tickets/TicketManagement')
  return { default: m.TicketManagement }
})

const PayslipManagement = lazy(async () => {
  const m = await import('@pages/admin/Payslips/PayslipManagement')
  return { default: m.PayslipManagement }
})

const Settings = lazy(async () => {
  const m = await import('@pages/admin/Settings/Settings')
  return { default: m.Settings }
})

const AdminHelpSupport = lazy(async () => {
  const m = await import('@pages/admin/Help/AdminHelpSupport')
  return { default: m.AdminHelpSupport }
})

const AdminMetalRoutingPage = lazy(async () => {
  const m = await import('@pages/admin/MetalRouting/AdminMetalRoutingPage')
  return { default: m.AdminMetalRoutingPage }
})

const ProjectAnalysisLayout = lazy(async () => {
  const m = await import('@layouts/ProjectAnalysisLayout')
  return { default: m.ProjectAnalysisLayout }
})

const ProjectAnalysisSignalPage = lazy(async () => {
  const m = await import('@pages/admin/ProjectAnalysis/ProjectAnalysisSignalPage')
  return { default: m.ProjectAnalysisSignalPage }
})

const AdminNotesPage = lazy(async () => {
  const m = await import('@pages/admin/Notes/AdminNotesPage')
  return { default: m.AdminNotesPage }
})

const AdminNotesDayRedirect = lazy(async () => {
  const m = await import('@pages/admin/Notes/AdminNotesPage')
  return { default: m.AdminNotesDayRedirect }
})

// ── Employee Pages ────────────────────────────────────────────
const EmployeeDashboardPage = lazy(() =>
  import('@pages/employee/Dashboard')
)

const EmployeeTimesheet = lazy(() =>
  import('@pages/employee/Timesheet')
)

const EmployeeLeaveRequest = lazy(() =>
  import('@pages/employee/LeaveRequest')
)

const EmployeeCalendar = lazy(() =>
  import('@pages/employee/CompanyCalendar')
)

const EmployeeDocuments = lazy(() =>
  import('@pages/employee/DocumentRequest')
)

const EmployeeTraining = lazy(() =>
  import('@pages/employee/Training')
)

const EmployeeAchievements = lazy(() =>
  import('@pages/employee/Achievements')
)

const EmployeeRaiseTickets = lazy(() =>
  import('@pages/employee/HelpSupport')
)

const EmployeeHelpSupport = lazy(() =>
  import('@pages/employee/EmployeeHelpSupport')
)

const EmployeeNotesPage = lazy(async () => {
  const m = await import('@pages/employee/EmployeeNotesPage')
  return { default: m.EmployeeNotesPage }
})

const EmployeeProfilePage = lazy(() =>
  import('@pages/employee/EmployeeProfile')
)

const EmployeeCellWorkflow = lazy(() =>
  import('@pages/employee/EmployeeCellWorkflow')
)

const EmployeeMetalRoutingLegacyRedirect = lazy(async () => {
  const m = await import('@pages/employee/ProjectAnalysis/EmployeeMetalRoutingLegacyRedirect')
  return { default: m.EmployeeMetalRoutingLegacyRedirect }
})

const EmployeeProjectsLegacyRedirect = lazy(async () => {
  const m = await import('@pages/employee/ProjectAnalysis/EmployeeProjectsLegacyRedirect')
  return { default: m.EmployeeProjectsLegacyRedirect }
})

// ── Not Found ────────────────────────────────────────────────
const NotFound = lazy(async () => {
  const m = await import('@pages/NotFound')
  return { default: m.NotFound }
})

// ── Root Redirect ─────────────────────────────────────────────
function RootRedirect() {
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const role = useAuthStore((s) => s.role)

  if (!isHydrated) {
    return <PageLoading />
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />
  }

  return (
    <Navigate
      to={role === 'admin' ? '/admin' : '/employee'}
      replace
    />
  )
}

function AuthLoginRoute() {
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const role = useAuthStore((s) => s.role)

  if (!isHydrated) {
    return <PageLoading />
  }

  if (isAuthenticated) {
    return <Navigate to={role === 'admin' ? '/admin' : '/employee'} replace />
  }

  return <LoginPage />
}

/** Redirect old /admin/project-analysis/* bookmarks to /admin/project-management/*. */
function ProjectManagementLegacyRedirect() {
  const location = useLocation()
  const next = location.pathname.replace(/^\/admin\/project-analysis/, '/admin/project-management')
  return <Navigate to={`${next}${location.search}${location.hash}`} replace />
}

/** Redirect legacy /admin/projects/* bookmarks to the Project Management portal. */
function AdminProjectsLegacyRedirect() {
  const location = useLocation()
  const next = location.pathname.replace(/^\/admin\/projects/, ROUTES.PROJECT_ANALYSIS_PROJECTS)
  return <Navigate to={`${next}${location.search}${location.hash}`} replace />
}

// ── App Routes ────────────────────────────────────────────────
export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* Root */}
        <Route path="/" element={<AuthLayout />}>
          <Route index element={<RootRedirect />} />
        </Route>

        {/* Auth */}
        <Route path="/auth" element={<AuthLayout />}>
          <Route path="login" element={<AuthLoginRoute />} />
        </Route>

        {/* Admin */}
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardHome />} />

            <Route path="employees">
              <Route index element={<EmployeeList />} />
              <Route path="add" element={<AddEmployee />} />
              <Route path=":id" element={<EmployeeProfile />} />
              <Route path=":id/edit" element={<EditEmployee />} />
            </Route>

            <Route
              path="leaves"
              element={<LeaveManagementDashboard />}
            />

            <Route path="timesheet" element={<ProjectManagement />} />

            <Route path="project-management" element={<ProjectAnalysisLayout />}>
              <Route index element={<Navigate to="projects" replace />} />
              <Route path="projects/:projectId/cells/:cellId" element={<ProjectCellPage />} />
              <Route path="projects/:projectId" element={<ProjectWorkspace />} />
              <Route path="projects" element={<AdminProjectsPage />} />
              <Route path="signal-analysis/*" element={<ProjectAnalysisSignalPage />} />
              <Route path="notes" element={<AdminNotesPage />} />
              <Route path="notes/day/:dateKey" element={<AdminNotesDayRedirect />} />
            </Route>

            <Route path="project-analysis/*" element={<ProjectManagementLegacyRedirect />} />

            <Route path="projects/*" element={<AdminProjectsLegacyRedirect />} />

            <Route path="metal-routing/*" element={<AdminMetalRoutingPage />} />

            <Route path="notes" element={<Navigate to={ROUTES.PROJECT_ANALYSIS_NOTES} replace />} />
            <Route path="notes/day/:dateKey" element={<AdminNotesDayRedirect />} />

            <Route
              path="calendar"
              element={<AdminCompanyCalendarPage />}
            />

            <Route
              path="training"
              element={<TrainingCourses />}
            />

            <Route
              path="achievements"
              element={<CompanyAchievements />}
            />

            <Route
              path="analytics"
              element={<Navigate to={`${ROUTES.TIMESHEET}?tab=analytics`} replace />}
            />

            <Route
              path="documents"
              element={<DocumentManagement />}
            />

            <Route
              path="news"
              element={<CompanyNews />}
            />

            <Route
              path="tickets"
              element={<TicketManagement />}
            />

            <Route
              path="payslips"
              element={<PayslipManagement />}
            />

            <Route
              path="settings"
              element={<Settings />}
            />

            <Route path="help" element={<AdminHelpSupport />} />
          </Route>
        </Route>

        {/* Employee */}
        <Route element={<ProtectedRoute roles={['employee']} />}>
          <Route path="/employee" element={<EmployeeLayout />}>
            <Route index element={<EmployeeDashboardPage />} />

            <Route
              path="timesheet"
              element={<EmployeeTimesheet />}
            />

            <Route path="project-analysis" element={<ProjectAnalysisLayout />}>
              <Route index element={<Navigate to="projects" replace />} />
              <Route path="projects/:projectId/cells/:cellId" element={<EmployeeCellWorkflow />} />
              <Route path="projects/:projectId" element={<ProjectWorkspace />} />
              <Route path="projects" element={<AdminProjectsPage />} />
              <Route path="signal-analysis/*" element={<ProjectAnalysisSignalPage />} />
              <Route path="notes" element={<EmployeeNotesPage />} />
            </Route>

            <Route path="projects/*" element={<EmployeeProjectsLegacyRedirect />} />

            <Route path="metal-routing/*" element={<EmployeeMetalRoutingLegacyRedirect />} />

            <Route path="notes" element={<Navigate to={ROUTES.EMPLOYEE_PROJECT_ANALYSIS_NOTES} replace />} />

            <Route
              path="leave"
              element={<EmployeeLeaveRequest />}
            />

            <Route
              path="calendar"
              element={<EmployeeCalendar />}
            />

            <Route
              path="documents"
              element={<EmployeeDocuments />}
            />

            <Route
              path="training"
              element={<EmployeeTraining />}
            />

            <Route
              path="achievements"
              element={<EmployeeAchievements />}
            />

            <Route
              path="profile"
              element={<EmployeeProfilePage />}
            />

            {/* Ticket Raising */}
            <Route
              path="tickets"
              element={<EmployeeRaiseTickets />}
            />

            {/* Help / Support */}
            <Route
              path="help"
              element={<EmployeeHelpSupport />}
            />

            {/* Backward compatibility */}
            <Route
              path="support"
              element={<Navigate to="/employee/tickets" replace />}
            />
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}