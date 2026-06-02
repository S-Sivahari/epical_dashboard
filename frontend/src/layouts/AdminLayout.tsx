import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { LoginBackground } from '@components/auth/LoginBackground'
import { AdminTopNav } from '@components/layout/AdminTopNav'
import { CommandBar } from '@components/layout/CommandBar'
import { PageLoading } from '@components/layout/PageLoading'

export function AdminLayout() {
  return (
    <div className="admin-portal cmd-portal flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden font-body text-[var(--text-primary)]">
      <div className="admin-portal-chrome relative z-20 shrink-0">
        <CommandBar />
        <AdminTopNav />
      </div>
      <main className="cmd-main relative z-0 flex min-h-0 flex-1 flex-col overflow-y-auto">
        <LoginBackground variant="admin" />
        <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
