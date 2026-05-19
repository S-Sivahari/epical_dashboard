import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Navbar } from './Navbar'
import { LogoutModal } from '@components/employee/shared/LogoutModal'
import { useUIStore } from '@store/employee/uiStore'
import { cn } from '@pages/employee/lib/utils'

export function AppLayout() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={cn('flex min-h-screen flex-col transition-all duration-300', sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64')}>
        <Navbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      <LogoutModal />
    </div>
  )
}
