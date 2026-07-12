import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { LoginBackground } from '@components/auth/LoginBackground'
import { PortalErrorBoundary } from '@components/employee/shared/PortalErrorBoundary'
import { EmployeeCommandBar } from './EmployeeCommandBar'
import { EmployeePageShell } from './EmployeePageShell'
import { EmployeeTopNav } from './EmployeeTopNav'
import { EmployeeNavWheel } from './EmployeeNavWheel'
import { SecretQuickSidebar } from '@components/layout/SecretQuickSidebar'
import { EmployeePageTransition } from './EmployeePageTransition'
import { EmployeePageLoading } from './EmployeePageLoading'
import { EmployeeTimesheetSync } from '@components/employee/shared/EmployeeTimesheetSync'
import { EmployeeAuthProfileSync } from '@components/employee/shared/EmployeeAuthProfileSync'
import { ROUTES } from '@constants/routes'
import { cn } from '@/utils/cn'

function EmployeeOutlet() {
  const { pathname } = useLocation()
  const skipPageShell =
    pathname.startsWith('/employee/projects')
    || pathname.includes('/metal-routing')
    || pathname.startsWith(ROUTES.EMPLOYEE_PROJECT_ANALYSIS)

  const page = (
    <EmployeePageTransition>
      <Outlet />
    </EmployeePageTransition>
  )

  if (skipPageShell) {
    return page
  }
  return <EmployeePageShell>{page}</EmployeePageShell>
}

export function AppLayout() {
  const { pathname } = useLocation()
  const isProjectAnalysis = pathname.startsWith(ROUTES.EMPLOYEE_PROJECT_ANALYSIS)

  return (
    <div
      className={cn(
        'employee-portal cmd-portal flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden font-body text-[var(--text-primary)]',
        isProjectAnalysis && 'admin-portal--project-analysis',
      )}
    >
      <EmployeeTimesheetSync />
      <EmployeeAuthProfileSync />
      <EmployeeNavWheel />
      <SecretQuickSidebar />
      {!isProjectAnalysis ? (
        <div className="employee-portal-chrome relative z-20 shrink-0">
          <EmployeeCommandBar />
          <EmployeeTopNav />
        </div>
      ) : null}
      <main className="cmd-main relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden max-lg:overflow-x-hidden max-lg:overflow-y-auto">
        <LoginBackground variant="admin" />
        <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
          <PortalErrorBoundary>
            <div className="emp-page-stage">
              <Suspense fallback={<EmployeePageLoading />}>
                <EmployeeOutlet />
              </Suspense>
            </div>
          </PortalErrorBoundary>
        </div>
      </main>
    </div>
  )
}
