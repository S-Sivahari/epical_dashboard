import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { PageLoading } from '@components/layout/PageLoading'
import { AuthLayout } from '@layouts/AuthLayout'
import { AdminLayout } from '@layouts/AdminLayout'
import { EmployeeLayout } from '@layouts/EmployeeLayout'
import { ProtectedRoute } from '@routes/ProtectedRoute'
import { useAuthStore } from '@store/authStore'

const LoginPage = lazy(async () => {
  const m = await import('@pages/auth/LoginPage')
  return { default: m.LoginPage }
})
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
const LeaveShell = lazy(async () => {
  const m = await import('@pages/admin/Leaves/LeaveShell')
  return { default: m.LeaveShell }
})
const LeavesIndexRedirect = lazy(async () => {
  const m = await import('@pages/admin/Leaves/LeaveShell')
  return { default: m.LeavesIndexRedirect }
})
const PendingLeaves = lazy(async () => {
  const m = await import('@pages/admin/Leaves/PendingLeaves')
  return { default: m.PendingLeaves }
})
const CompensationLeaves = lazy(async () => {
  const m = await import('@pages/admin/Leaves/CompensationLeaves')
  return { default: m.CompensationLeaves }
})
const HolidayManagement = lazy(async () => {
  const m = await import('@pages/admin/Leaves/HolidayManagement')
  return { default: m.HolidayManagement }
})
const ProjectManagement = lazy(async () => {
  const m = await import('@pages/admin/Projects/ProjectManagement')
  return { default: m.ProjectManagement }
})
const CompanyCalendar = lazy(async () => {
  const m = await import('@pages/admin/Calendar/CompanyCalendar')
  return { default: m.CompanyCalendar }
})
const TrainingCourses = lazy(async () => {
  const m = await import('@pages/admin/Training/TrainingCourses')
  return { default: m.TrainingCourses }
})
const CompanyAchievements = lazy(async () => {
  const m = await import('@pages/admin/Achievements/CompanyAchievements')
  return { default: m.CompanyAchievements }
})
const Analytics = lazy(async () => {
  const m = await import('@pages/admin/Analytics/Analytics')
  return { default: m.Analytics }
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
const Settings = lazy(async () => {
  const m = await import('@pages/admin/Settings/Settings')
  return { default: m.Settings }
})
const NotFound = lazy(async () => {
  const m = await import('@pages/NotFound')
  return { default: m.NotFound }
})

const EmployeeDashboard = lazy(() => import('@pages/employee/Dashboard'))
const EmployeeTimesheet = lazy(() => import('@pages/employee/Timesheet'))
const EmployeeLeaveRequest = lazy(() => import('@pages/employee/LeaveRequest'))
const EmployeeCalendar = lazy(() => import('@pages/employee/CompanyCalendar'))
const EmployeeDocuments = lazy(() => import('@pages/employee/DocumentRequest'))
const EmployeeTraining = lazy(() => import('@pages/employee/Training'))
const EmployeeAchievements = lazy(() => import('@pages/employee/Achievements'))
const EmployeeSupport = lazy(() => import('@pages/employee/HelpSupport'))

function RootRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const role = useAuthStore((s) => s.role)

  if (!isAuthenticated) return <Navigate to="/auth/login" replace />
  return <Navigate to={role === 'admin' ? '/admin' : '/employee'} replace />
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<AuthLayout />}>
          <Route index element={<RootRedirect />} />
        </Route>

        <Route path="/auth" element={<AuthLayout />}>
          <Route path="login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="employees">
              <Route index element={<EmployeeList />} />
              <Route path="add" element={<AddEmployee />} />
              <Route path=":id" element={<EmployeeProfile />} />
              <Route path=":id/edit" element={<EditEmployee />} />
            </Route>
            <Route path="leaves" element={<LeaveShell />}>
              <Route index element={<LeavesIndexRedirect />} />
              <Route path="pending" element={<PendingLeaves />} />
              <Route path="compensation" element={<CompensationLeaves />} />
              <Route path="holidays" element={<HolidayManagement />} />
            </Route>
            <Route path="projects" element={<ProjectManagement />} />
            <Route path="calendar" element={<CompanyCalendar />} />
            <Route path="training" element={<TrainingCourses />} />
            <Route path="achievements" element={<CompanyAchievements />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="documents" element={<DocumentManagement />} />
            <Route path="news" element={<CompanyNews />} />
            <Route path="tickets" element={<TicketManagement />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['employee']} />}>
          <Route path="/employee" element={<EmployeeLayout />}>
            <Route index element={<EmployeeDashboard />} />
            <Route path="timesheet" element={<EmployeeTimesheet />} />
            <Route path="leave" element={<EmployeeLeaveRequest />} />
            <Route path="calendar" element={<EmployeeCalendar />} />
            <Route path="documents" element={<EmployeeDocuments />} />
            <Route path="training" element={<EmployeeTraining />} />
            <Route path="achievements" element={<EmployeeAchievements />} />
            <Route path="support" element={<EmployeeSupport />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
