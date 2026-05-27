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
  Receipt,
  Ticket,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@store/authStore'
import { cn } from '@/utils/cn'
import { ROUTES } from '@constants/routes'
import { useUiStore } from '@store/uiStore'
import { useMediaQuery } from '@hooks/useMediaQuery'
import { useNotificationCounts } from '@hooks/useNotificationCounts'
import { NotificationBadge } from '@components/ui/NotificationBadge'
import { APP_SHORT_NAME } from '@/utils/constants'

const groups: {
  label: string
  items: { to: string; label: string; icon: typeof LayoutGrid; end?: boolean; notificationKey?: 'leaves' | 'documents' }[]
}[] = [
    {
      label: 'Main',
      items: [{ to: ROUTES.DASHBOARD, label: 'Dashboard', icon: LayoutGrid, end: true }],
    },
    {
      label: 'People',
      items: [
        { to: ROUTES.EMPLOYEES, label: 'Manage Employees', icon: Users, end: true },
        { to: ROUTES.LEAVES, label: 'Manage Leaves', icon: CalendarCheck, notificationKey: 'leaves' },
      ],
    },
    {
      label: 'Work',
      items: [
        { to: ROUTES.PROJECTS, label: 'Projects / Timesheet', icon: Briefcase },
        { to: ROUTES.CALENDAR, label: 'Company Calendar', icon: CalendarDays },
      ],
    },
    {
      label: 'Company',
      items: [
        { to: ROUTES.PAYSLIPS, label: 'Payslips', icon: Receipt },
        { to: ROUTES.TRAINING, label: 'Training & Courses', icon: BookOpen },
        { to: ROUTES.ACHIEVEMENTS, label: 'Company achievements', icon: Trophy },
        { to: ROUTES.ANALYTICS, label: 'Analytics', icon: BarChart3 },
        { to: ROUTES.DOCUMENTS, label: 'Documents Request', icon: FileText, notificationKey: 'documents' },
        { to: ROUTES.NEWS, label: 'Manage News', icon: Newspaper },
        { to: ROUTES.TICKETS, label: 'Tickets', icon: Ticket },
      ],
    },
  ]

export function Sidebar() {
  const isLg = useMediaQuery('(min-width: 1024px)')
  const { sidebarOpen, setSidebarOpen, toggleSidebar } = useUiStore()
  const { counts: notificationCounts } = useNotificationCounts()
  const showDrawer = !isLg && sidebarOpen
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/auth/login')
    if (!isLg) setSidebarOpen(false)
  }

  return (
    <>
      {!isLg ? (
        <button
          type="button"
          className="fixed left-4 top-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-100/90 bg-white shadow-md shadow-emerald-950/5 lg:hidden"
          onClick={toggleSidebar}
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <X className="h-5 w-5 text-emerald-900" /> : <Menu className="h-5 w-5 text-emerald-900" />}
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
          'fixed left-0 top-0 z-40 flex h-full w-[260px] flex-col border-r border-emerald-100/80 bg-gradient-to-b from-white via-emerald-50/25 to-emerald-50/45 shadow-[4px_0_24px_-8px_rgba(16,185,129,0.15)] transition-transform duration-200 ease-in-out lg:translate-x-0',
          isLg ? 'translate-x-0' : sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-emerald-100/70 bg-white/70 px-5 backdrop-blur-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-sm font-bold text-white shadow-md shadow-emerald-900/20 ring-2 ring-white">
            E
          </div>
          <div>
            <p className="font-display text-sm font-semibold tracking-tight text-slate-900">{APP_SHORT_NAME}</p>
            <p className="text-xs font-medium text-emerald-700/55">Enterprise</p>
          </div>
        </div>
        <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-4 pb-3">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-900/40">
                {g.label}
              </p>
              <div className="space-y-1">
                {g.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end ?? false}
                    onClick={() => !isLg && setSidebarOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-ui',
                        isActive
                          ? 'border-l-[3px] border-emerald-600 bg-white text-emerald-950 shadow-md shadow-emerald-900/[0.07]'
                          : 'border-l-[3px] border-transparent text-slate-600 hover:bg-white/75 hover:text-emerald-950',
                      )
                    }
                  >
                    <item.icon className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-[0.92]" />
                    <span className="truncate">{item.label}</span>
                    {item.notificationKey && (
                      <NotificationBadge 
                        count={notificationCounts[item.notificationKey]} 
                        size="sm"
                        className="right-2"
                      />
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-emerald-100/80 bg-white/50 p-3 backdrop-blur-[2px]">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-emerald-100/80 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition-ui hover:border-red-100 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Log out
          </button>
        </div>
      </aside>
    </>
  )
}
