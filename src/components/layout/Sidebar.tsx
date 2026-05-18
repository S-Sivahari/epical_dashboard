import {
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  FileText,
  LayoutGrid,
  LogOut,
  Menu,
  Newspaper,
  Settings,
  Ticket,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { useAuthStore } from '@store/authStore'
import { useUiStore } from '@store/uiStore'
import { useMediaQuery } from '@hooks/useMediaQuery'

const groups: { label: string; items: { to: string; label: string; icon: typeof LayoutGrid }[] }[] = [
  {
    label: 'Main',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutGrid }],
  },
  {
    label: 'People',
    items: [
      { to: '/dashboard/employees', label: 'Employees', icon: Users },
      { to: '/dashboard/leaves', label: 'Leave Management', icon: CalendarCheck },
    ],
  },
  {
    label: 'Work',
    items: [
      { to: '/dashboard/projects', label: 'Projects / Timesheet', icon: Briefcase },
      { to: '/dashboard/calendar', label: 'Company Calendar', icon: CalendarDays },
    ],
  },
  {
    label: 'Company',
    items: [
      { to: '/dashboard/training', label: 'Training & Courses', icon: BookOpen },
      { to: '/dashboard/achievements', label: 'Achievements', icon: Trophy },
      { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/dashboard/documents', label: 'Documents', icon: FileText },
      { to: '/dashboard/news', label: 'Company News', icon: Newspaper },
      { to: '/dashboard/tickets', label: 'Tickets', icon: Ticket },
    ],
  },
  {
    label: 'System',
    items: [{ to: '/dashboard/settings', label: 'Settings', icon: Settings }],
  },
]

export function Sidebar() {
  const isLg = useMediaQuery('(min-width: 1024px)')
  const { sidebarOpen, setSidebarOpen, toggleSidebar } = useUiStore()
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const showDrawer = !isLg && sidebarOpen

  return (
    <>
      {!isLg ? (
        <button
          type="button"
          className="fixed left-4 top-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-white shadow-sm lg:hidden"
          onClick={toggleSidebar}
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      ) : null}

      {showDrawer ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-full w-[260px] flex-col border-r border-border bg-white transition-transform duration-200 ease-in-out lg:translate-x-0',
          isLg ? 'translate-x-0' : sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">
            H
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-ink">HRMS Admin</p>
            <p className="text-xs text-muted">Enterprise</p>
          </div>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{g.label}</p>
              <div className="space-y-1">
                {g.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/dashboard'}
                    onClick={() => !isLg && setSidebarOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-ui',
                        isActive
                          ? 'border-l-4 border-primary bg-emerald-50 text-emerald-900'
                          : 'border-l-4 border-transparent text-muted hover:bg-surface',
                        isActive && 'text-emerald-900',
                      )
                    }
                  >
                    <item.icon className={cn('h-5 w-5', 'opacity-90')} />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-ui hover:bg-surface hover:text-danger"
            onClick={() => {
              logout()
              navigate('/')
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
