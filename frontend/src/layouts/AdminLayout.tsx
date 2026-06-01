import { Suspense, type CSSProperties } from 'react'
import { Outlet } from 'react-router-dom'
import { LoginBackground } from '@components/auth/LoginBackground'
import { CommandBar } from '@components/layout/CommandBar'
import { CommandPalette } from '@components/command-center/CommandPalette'
import {
  SmartSidebar,
  SMART_SIDEBAR_COLLAPSED,
  SMART_SIDEBAR_EXPANDED,
} from '@components/layout/SmartSidebar'
import { PageLoading } from '@components/layout/PageLoading'
import { useUiStore } from '@store/uiStore'
import { cn } from '@/utils/cn'

export function AdminLayout() {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)

  const sidebarOffset = sidebarCollapsed
    ? SMART_SIDEBAR_COLLAPSED + 24
    : SMART_SIDEBAR_EXPANDED + 24

  return (
    <div className="admin-portal cmd-portal flex h-screen overflow-hidden font-body text-[var(--text-primary)]">
      <SmartSidebar />
      <div
        className={cn(
          'flex flex-1 flex-col overflow-hidden transition-[padding] duration-300 ease-out',
          'pl-0 lg:pl-[var(--cmd-sidebar-offset)]',
        )}
        style={
          {
            '--cmd-sidebar-offset': `${sidebarOffset}px`,
          } as CSSProperties
        }
      >
        <CommandBar />
        <CommandPalette />
        <main className="cmd-main relative flex-1 overflow-y-auto has-[[data-admin-dashboard]]:overflow-hidden">
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
