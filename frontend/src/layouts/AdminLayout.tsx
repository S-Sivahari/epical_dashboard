import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { LoginBackground } from '@components/auth/LoginBackground'
import { AdminTopNav } from '@components/layout/AdminTopNav'
import { CommandBar } from '@components/layout/CommandBar'
import { PageLoading } from '@components/layout/PageLoading'

export function AdminLayout() {
  return (
    <div className="admin-portal cmd-portal flex h-screen flex-col overflow-hidden font-body text-[var(--text-primary)]">
      <CommandBar />
      <AdminTopNav />
      <main className="cmd-main relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        <LoginBackground variant="admin" />
        <div className="relative z-[1] min-h-full">
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
