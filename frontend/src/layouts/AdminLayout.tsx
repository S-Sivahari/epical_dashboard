import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Navbar } from '@components/layout/Navbar'
import { Sidebar } from '@components/layout/Sidebar'
import { PageLoading } from '@components/layout/PageLoading'

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <div className="lg:pl-[260px]">
        <Navbar />
        <main className="min-h-screen bg-white pt-16">
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
