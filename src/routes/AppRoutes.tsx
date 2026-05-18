import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { PageLoading } from '@components/layout/PageLoading'
import { AuthLayout } from '@layouts/AuthLayout'
import { DashboardLayout } from '@layouts/DashboardLayout'
import { ProtectedRoute } from '@routes/ProtectedRoute'

const LoginPage = lazy(async () => {
  const m = await import('@pages/Auth/LoginPage')
  return { default: m.LoginPage }
})
const DashboardHome = lazy(async () => {
  const m = await import('@pages/Dashboard/DashboardHome')
  return { default: m.DashboardHome }
})
const EmployeeList = lazy(async () => {
  const m = await import('@pages/Employees/EmployeeList')
  return { default: m.EmployeeList }
})
const AddEmployee = lazy(async () => {
  const m = await import('@pages/Employees/AddEmployee')
  return { default: m.AddEmployee }
})
const EmployeeProfile = lazy(async () => {
  const m = await import('@pages/Employees/EmployeeProfile')
  return { default: m.EmployeeProfile }
})
const EditEmployee = lazy(async () => {
  const m = await import('@pages/Employees/EditEmployee')
  return { default: m.EditEmployee }
})
const LeaveShell = lazy(async () => {
  const m = await import('@pages/Leaves/LeaveShell')
  return { default: m.LeaveShell }
})
const LeavesIndexRedirect = lazy(async () => {
  const m = await import('@pages/Leaves/LeaveShell')
  return { default: m.LeavesIndexRedirect }
})
const PendingLeaves = lazy(async () => {
  const m = await import('@pages/Leaves/PendingLeaves')
  return { default: m.PendingLeaves }
})
const CompensationLeaves = lazy(async () => {
  const m = await import('@pages/Leaves/CompensationLeaves')
  return { default: m.CompensationLeaves }
})
const HolidayManagement = lazy(async () => {
  const m = await import('@pages/Leaves/HolidayManagement')
  return { default: m.HolidayManagement }
})
const ProjectManagement = lazy(async () => {
  const m = await import('@pages/Projects/ProjectManagement')
  return { default: m.ProjectManagement }
})
const CompanyCalendar = lazy(async () => {
  const m = await import('@pages/Calendar/CompanyCalendar')
  return { default: m.CompanyCalendar }
})
const TrainingCourses = lazy(async () => {
  const m = await import('@pages/Training/TrainingCourses')
  return { default: m.TrainingCourses }
})
const CompanyAchievements = lazy(async () => {
  const m = await import('@pages/Achievements/CompanyAchievements')
  return { default: m.CompanyAchievements }
})
const Analytics = lazy(async () => {
  const m = await import('@pages/Analytics/Analytics')
  return { default: m.Analytics }
})
const DocumentManagement = lazy(async () => {
  const m = await import('@pages/Documents/DocumentManagement')
  return { default: m.DocumentManagement }
})
const CompanyNews = lazy(async () => {
  const m = await import('@pages/News/CompanyNews')
  return { default: m.CompanyNews }
})
const TicketManagement = lazy(async () => {
  const m = await import('@pages/Tickets/TicketManagement')
  return { default: m.TicketManagement }
})
const Settings = lazy(async () => {
  const m = await import('@pages/Settings/Settings')
  return { default: m.Settings }
})
const NotFound = lazy(async () => {
  const m = await import('@pages/NotFound')
  return { default: m.NotFound }
})

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<AuthLayout />}>
          <Route index element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<DashboardLayout />}>
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

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
