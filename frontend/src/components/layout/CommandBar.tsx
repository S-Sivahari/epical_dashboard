import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, LogOut, Plus } from 'lucide-react'
import { CompanyLogo } from '@components/auth/CompanyLogo'
import { Avatar } from '@components/ui/Avatar'
import { NotificationBell } from '@components/layout/NotificationBell'
import { useAuthStore } from '@store/authStore'
import { ROUTES } from '@constants/routes'
import { formatDate } from '@/utils/formatDate'

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
  const isDashboard = pathname === ROUTES.DASHBOARD || pathname === '/admin'

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

  const handleLogout = () => {
    logout()
    navigate('/auth/login')
  }

  return (
    <header className="cmd-bar flex h-[4.25rem] shrink-0 items-center gap-3 px-4 lg:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <CompanyLogo className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" alt="Epical Layouts" />

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

        {isDashboard && user && (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              name={user.name}
              src={user.avatarUrl}
              size="lg"
              color="var(--emerald-primary)"
              className="cmd-dashboard-avatar h-11 w-11 shrink-0 text-sm font-bold"
            />
            <div className="min-w-0">
              <p className="truncate font-display text-base font-extrabold text-[#1a4712] sm:text-lg">
                Welcome back, {user.name?.split(' ')[0] ?? 'Admin'}!
              </p>
              <p className="truncate text-xs font-medium text-slate-600 sm:text-sm">
                Admin Portal
                {user.joinedAt ? (
                  <>
                    {' '}
                    · Joined {formatDate(user.joinedAt, 'yyyy-MM-dd')}
                  </>
                ) : null}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <NotificationBell />

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
            <button type="button" className="cmd-profile-btn flex items-center gap-2 rounded-xl px-1.5 py-1">
              <Avatar name={user?.name ?? 'Admin'} src={user?.avatarUrl} size="sm" color="#266b1c" className="!ring-0" />
              <ChevronDown className="hidden h-3.5 w-3.5 text-[var(--text-muted)] sm:block" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="cmd-dropdown z-50 min-w-[220px] p-1" sideOffset={8} align="end">
              <div className="border-b border-[var(--border-subtle)] px-3 py-2.5">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{user?.name}</p>
                <p className="text-xs text-[var(--text-muted)]">Admin Portal</p>
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <button
          type="button"
          onClick={handleLogout}
          className="cmd-logout-btn inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold sm:px-3"
          aria-label="Log out"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden md:inline">Log out</span>
        </button>
      </div>
    </header>
  )
}
