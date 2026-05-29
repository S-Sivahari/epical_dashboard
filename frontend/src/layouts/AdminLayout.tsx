import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { LoginBackground } from '@components/auth/LoginBackground'
import { Navbar } from '@components/layout/Navbar'
import { Sidebar } from '@components/layout/Sidebar'
import { PageLoading } from '@components/layout/PageLoading'

export function AdminLayout() {
  return (
    <div className="admin-portal flex h-screen overflow-hidden font-body text-white">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden lg:pl-[260px]">
        <div className="relative z-30 h-16 shrink-0">
          <Navbar />
        </div>
        <main className="main-dashboard-container crewiq-dashboard relative flex-1 overflow-y-auto">
          <LoginBackground variant="admin" />
          <div className="relative z-[1] min-h-full">
            <Suspense fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}
