import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Navbar } from '@components/layout/Navbar'
import { Sidebar } from '@components/layout/Sidebar'
import { PageLoading } from '@components/layout/PageLoading'

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-[#18181b] font-body text-white">
      <Sidebar />
      <div className="lg:pl-[260px]">
        <Navbar />
        <main className="relative min-h-[calc(100vh-3.5rem)] bg-[#18181b] pt-14">
          <div className="relative z-[1]">
            <Suspense fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}
