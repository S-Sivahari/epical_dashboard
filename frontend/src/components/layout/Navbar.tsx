import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Avatar } from '@components/ui/Avatar'
import { useAuthStore } from '@store/authStore'
import { useMediaQuery } from '@hooks/useMediaQuery'
import { APP_SHORT_NAME } from '@/utils/constants'
import { NotificationBell } from './NotificationBell'

function titleCase(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const routeTitles: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/dashboard': 'Dashboard',
  '/employee': 'Dashboard',
  '/admin/employees': 'Manage Employees',
  '/admin/leaves': 'Manage Leaves',
  '/admin/holidays': 'Company Holidays',
  '/admin/projects': 'Manage Projects',
  '/admin/tickets': 'Ticket management',
  '/admin/timesheets': 'Manage Timesheets',
  '/admin/payslips': 'Manage Payslips',
  '/admin/calendar': 'Company Calendar',
  '/admin/news': 'Manage News',
  '/admin/documents': 'Documents Request',
  '/admin/settings': 'Settings',
  '/admin/analytics': 'Analytics',
  '/admin/achievements': 'Achievements',
  '/admin/training': 'Training & Courses',
}

export function Navbar() {
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const isLg = useMediaQuery('(min-width: 1024px)')

  const title = useMemo(() => {
    if (routeTitles[pathname]) return routeTitles[pathname]

    const parts = pathname.split('/').filter(Boolean)
    if (parts.length > 2) {
      const parentPath = `/${parts[0]}/${parts[1]}`
      if (routeTitles[parentPath]) return routeTitles[parentPath]
    }

    if (pathname === '/admin' || pathname === '/employee') return 'Dashboard'
    const last = parts[parts.length - 1] ?? 'dashboard'
    if (last.match(/^[a-z0-9-]+$/i) && last.length < 24) return titleCase(last)
    return APP_SHORT_NAME
  }, [pathname])

  const showBack = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean)
    return parts.length > 2
  }, [pathname])

  return (
    <header
      className="admin-navbar flex h-16 items-center justify-between gap-4 px-4"
      style={{ paddingLeft: isLg ? undefined : '3.25rem' }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {showBack && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="admin-navbar-icon-btn flex shrink-0 items-center justify-center p-1.5"
            title="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <p className="truncate font-display text-xl font-semibold tracking-tight text-white md:text-2xl">
          {title}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <NotificationBell />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className="admin-navbar-user-btn flex max-w-[min(100vw-8rem,18rem)] items-center gap-2 px-2 py-1.5 text-left text-sm">
              <Avatar name={user?.name ?? 'Admin'} src={user?.avatarUrl} size="sm" color="#00e676" className="!ring-0" />
              <div className="hidden min-w-0 flex-1 flex-col sm:flex">
                <span className="truncate font-semibold leading-tight text-white">{user?.name}</span>
                <span className="truncate text-xs font-medium text-[#8b8b96]">
                  {user?.designation || user?.role || 'Admin'}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-[#8b8b96]" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="admin-navbar-menu z-50 min-w-[200px] p-1" sideOffset={6} align="end">
              <DropdownMenu.Item
                className="cursor-pointer rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none hover:bg-white/5"
                onSelect={() => navigate('/admin/settings')}
              >
                Settings
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-zinc-700/50" />
              <DropdownMenu.Item
                className="cursor-pointer rounded-lg px-3 py-2 text-sm text-red-400 outline-none hover:bg-red-950/30"
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
