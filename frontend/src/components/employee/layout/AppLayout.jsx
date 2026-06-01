import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Navbar } from './Navbar'
import { PageLoading } from '@components/layout/PageLoading'
import { PortalErrorBoundary } from '@components/employee/shared/PortalErrorBoundary'
import { useUIStore } from '@store/employee/uiStore'
import { cn } from '@pages/employee/lib/utils'

export function AppLayout() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div
        className={cn(
          'flex flex-1 flex-col overflow-hidden transition-[padding] duration-300 ease-in-out',
          sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[248px]',
        )}
      >
        <Navbar />
        <main className="employee-portal flex-1 overflow-y-auto p-4 md:p-5 lg:p-6">
          <PortalErrorBoundary>
            <Suspense fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          </PortalErrorBoundary>
        </main>
      </div>
    </div>
  )
}
