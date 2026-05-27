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
        <main className="relative min-h-screen bg-white pt-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-0 h-80 bg-gradient-to-b from-emerald-50/45 via-transparent to-transparent"
          />
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
