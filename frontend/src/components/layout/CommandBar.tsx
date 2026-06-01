import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  Building2,
  ChevronDown,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Avatar } from '@components/ui/Avatar'
import { NotificationBell } from '@components/layout/NotificationBell'
import { useAuthStore } from '@store/authStore'
import { useDashboardStore } from '@store/dashboardStore'
import { useNotificationStore } from '@store/notificationStore'
import { useMediaQuery } from '@hooks/useMediaQuery'
import { ROUTES } from '@constants/routes'
import { formatDistanceToNow } from 'date-fns'

function titleCase(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const routeTitles: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/employees': 'Employees',
  '/admin/leaves': 'Leave Management',
  '/admin/projects': 'Projects & Timesheets',
  '/admin/tickets': 'Tickets',
  '/admin/payslips': 'Payslips',
  '/admin/calendar': 'Calendar',
  '/admin/news': 'News',
  '/admin/documents': 'Documents',
  '/admin/settings': 'Settings',
  '/admin/analytics': 'Analytics',
  '/admin/achievements': 'Achievements',
  '/admin/training': 'Training',
}

export function CommandBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const setCommandPaletteOpen = useDashboardStore((s) => s.setCommandPaletteOpen)
  const isLg = useMediaQuery('(min-width: 1024px)')
  const isDashboard = pathname === ROUTES.DASHBOARD || pathname === '/admin'
  const notifications = useNotificationStore((s) => s.notifications)

  const recentActivities = useMemo(
    () =>
      notifications.slice(0, 6).map((n) => ({
        id: n.id,
        title: n.title,
        detail: n.message,
        time: n.createdAt,
      })),
    [notifications],
  )

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const pageTitle = useMemo(() => {
    if (routeTitles[pathname]) return routeTitles[pathname]
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length > 2) {
      const parentPath = `/${parts[0]}/${parts[1]}`
      if (routeTitles[parentPath]) return routeTitles[parentPath]
    }
    const last = parts[parts.length - 1] ?? 'dashboard'
    if (last.match(/^[a-z0-9-]+$/i) && last.length < 24) return titleCase(last)
    return 'Admin'
  }, [pathname])

  const showBack = pathname.split('/').filter(Boolean).length > 2

  const quickCreateItems = [
    { label: 'Add Employee', action: () => navigate(ROUTES.EMPLOYEE_ADD) },
    { label: 'Post Announcement', action: () => navigate(ROUTES.NEWS) },
    { label: 'Create Event', action: () => navigate(ROUTES.CALENDAR) },
    { label: 'Generate Payslip', action: () => navigate(ROUTES.PAYSLIPS) },
  ]

  return (
    <header
      className="cmd-bar flex h-[4.25rem] shrink-0 items-center gap-3 px-4 lg:px-5"
      style={{ paddingLeft: isLg ? undefined : '3.25rem' }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {!isDashboard && (
          <>
            {showBack && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="cmd-bar-icon-btn shrink-0"
                title="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold tracking-tight text-[var(--text-primary)] lg:text-xl">
                {pageTitle}
              </p>
            </div>
          </>
        )}
        {isDashboard && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="min-w-0"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-blue-dark)]">{greeting}</p>
            <p className="truncate font-display text-lg font-semibold tracking-tight lg:text-xl">
              <span className="text-[var(--text-primary)]">{user?.name?.split(' ')[0] ?? 'Admin'}</span>
              <span className="text-[var(--text-slate-blue)]">, your </span>
              <span className="text-[var(--text-green-deep)]">dashboard</span>
              <span className="text-[var(--text-slate-blue)]"> is ready</span>
            </p>
          </motion.div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        className="cmd-search-trigger hidden max-w-md flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left sm:flex lg:max-w-sm xl:max-w-md"
      >
        <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        <span className="flex-1 truncate text-sm text-[var(--text-muted)]">Search anything...</span>
        <kbd className="cmd-kbd hidden lg:inline">⌘K</kbd>
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--text-indigo)]" />
      </button>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="cmd-bar-icon-btn sm:hidden"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>

        <NotificationBell />

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className="cmd-bar-icon-btn hidden sm:inline-flex" title="Recent activity">
              <Activity className="h-4 w-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="cmd-dropdown z-50 w-80 p-0" sideOffset={8} align="end">
              <div className="border-b border-[var(--border-subtle)] px-4 py-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Recent Activity</h3>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {recentActivities.map((item) => (
                  <div key={item.id} className="cmd-activity-item px-4 py-3">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">{item.detail}</p>
                    <span className="mt-1 block text-[10px] text-[var(--text-muted)]">
                      {formatDistanceToNow(new Date(item.time), { addSuffix: true })}
                    </span>
                  </div>
                ))}
                {recentActivities.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No recent activity</p>
                )}
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className="cmd-create-btn hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold sm:inline-flex">
              <Plus className="h-4 w-4" />
              <span className="hidden md:inline">Create</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="cmd-dropdown z-50 min-w-[200px] p-1" sideOffset={8} align="end">
              {quickCreateItems.map((item) => (
                <DropdownMenu.Item
                  key={item.label}
                  className="cmd-dropdown-item"
                  onSelect={item.action}
                >
                  {item.label}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className="cmd-workspace-btn hidden items-center gap-2 rounded-xl px-2.5 py-1.5 lg:inline-flex">
              <Building2 className="h-4 w-4 text-[var(--green-600)]" />
              <span className="text-sm font-medium text-[var(--text-primary)]">EMPWR</span>
              <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="cmd-dropdown z-50 min-w-[180px] p-1" sideOffset={8} align="end">
              <DropdownMenu.Item className="cmd-dropdown-item cmd-dropdown-item-active">
                EMPWR Enterprise
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className="cmd-profile-btn flex items-center gap-2 rounded-xl px-1.5 py-1">
              <Avatar name={user?.name ?? 'Admin'} src={user?.avatarUrl} size="sm" color="#166534" className="!ring-0" />
              <ChevronDown className="hidden h-3.5 w-3.5 text-[var(--text-muted)] sm:block" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="cmd-dropdown z-50 min-w-[220px] p-1" sideOffset={8} align="end">
              <div className="border-b border-[var(--border-subtle)] px-3 py-2.5">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{user?.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{user?.designation || user?.role || 'Admin'}</p>
              </div>
              <DropdownMenu.Item className="cmd-dropdown-item" onSelect={() => navigate(ROUTES.SETTINGS)}>
                Settings
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-[var(--border-subtle)]" />
              <DropdownMenu.Item
                className="cmd-dropdown-item text-[var(--emerald-dark)] hover:bg-[var(--emerald-surface)]"
                onSelect={() => {
                  logout()
                  navigate('/auth/login')
                }}
              >
                Log out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  )
}
