import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { LoginBackground } from '@components/auth/LoginBackground'
import { PageLoading } from '@components/layout/PageLoading'
import { PortalErrorBoundary } from '@components/employee/shared/PortalErrorBoundary'
import { EmployeeCommandBar } from './EmployeeCommandBar'
import { EmployeePageShell } from './EmployeePageShell'
import { EmployeeTopNav } from './EmployeeTopNav'

export function AppLayout() {
  return (
    <div className="employee-portal cmd-portal flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden font-body text-[var(--text-primary)]">
      <div className="employee-portal-chrome relative z-20 shrink-0">
        <EmployeeCommandBar />
        <EmployeeTopNav />
      </div>
      <main className="cmd-main relative z-0 flex min-h-0 flex-1 flex-col overflow-y-auto">
        <LoginBackground variant="admin" />
        <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
          <PortalErrorBoundary>
            <Suspense fallback={<PageLoading />}>
              <EmployeePageShell>
                <Outlet />
              </EmployeePageShell>
            </Suspense>
          </PortalErrorBoundary>
        </div>
      </main>
    </div>
  )
}
