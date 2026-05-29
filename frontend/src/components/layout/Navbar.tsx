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

// Map routes to their display titles
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
    // Check if there's a direct route mapping
    if (routeTitles[pathname]) return routeTitles[pathname]

    // For sub-routes (like /admin/employees/1), use parent route
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length > 2) {
      const parentPath = `/${parts[0]}/${parts[1]}`
      if (routeTitles[parentPath]) return routeTitles[parentPath]
    }

    // Fallback to title case
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
      className="fixed right-0 top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-zinc-700/50 bg-[#1f1f23]/95 px-4 shadow-[0_1px_0_0_rgba(0,0,0,0.2)] backdrop-blur-md lg:left-[260px]"
      style={{ paddingLeft: isLg ? undefined : '3.25rem' }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {showBack && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex shrink-0 items-center justify-center rounded-xl border border-zinc-700/50 bg-[#27272a] p-1.5 text-slate-300 transition-ui hover:border-zinc-600 hover:bg-[#3f3f46]"
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
            <button
              type="button"
              className="flex max-w-[min(100vw-8rem,18rem)] items-center gap-2 rounded-xl border border-zinc-700/50 bg-[#27272a] px-2 py-1.5 text-left text-sm shadow-sm transition-ui hover:border-zinc-600 hover:bg-[#3f3f46]"
            >
              <Avatar name={user?.name ?? 'Admin'} src={user?.avatarUrl} size="sm" />
              <div className="hidden min-w-0 flex-1 flex-col sm:flex">
                <span className="truncate font-semibold leading-tight text-white">
                  {user?.name}
                </span>
                <span className="truncate text-xs font-medium text-[#8892a4]">
                  {user?.designation || user?.role || 'Admin'}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-[#8892a4]" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-[200px] rounded-xl border border-zinc-700/50 bg-[#27272a] p-1 shadow-lg shadow-black/30"
              sideOffset={6}
              align="end"
            >
              <DropdownMenu.Item
                className="cursor-pointer rounded-lg px-3 py-2 text-sm text-slate-200 outline-none hover:bg-[#3f3f46]"
                onSelect={() => navigate('/admin/settings')}
              >
                Settings
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-slate-700/50" />
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
