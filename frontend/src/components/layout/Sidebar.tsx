import {
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  FileText,
  LayoutGrid,
  Menu,
  Newspaper,
  Receipt,
  Ticket,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { ROUTES } from '@constants/routes'
import { useUiStore } from '@store/uiStore'
import { useMediaQuery } from '@hooks/useMediaQuery'
import { useNotificationCounts } from '@hooks/useNotificationCounts'
import { NotificationBadge } from '@components/ui/NotificationBadge'

const groups: {
  label: string
  items: {
    to: string
    label: string
    icon: typeof LayoutGrid
    end?: boolean
    notificationKey?: 'leaves' | 'documents'
  }[]
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
      {
        to: ROUTES.DOCUMENTS,
        label: 'Documents Request',
        icon: FileText,
        notificationKey: 'documents',
      },
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

  return (
    <>
      {!isLg ? (
        <button
          type="button"
          className="admin-sidebar-toggle fixed left-4 top-4 z-40 lg:hidden"
          onClick={toggleSidebar}
          aria-label="Toggle menu"
        >
          {sidebarOpen ? (
            <X className="h-5 w-5 text-zinc-300" />
          ) : (
            <Menu className="h-5 w-5 text-zinc-300" />
          )}
        </button>
      ) : null}

      {showDrawer ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'admin-sidebar sidebar-navigation fixed left-0 top-0 z-40 flex h-full w-[260px] flex-col transition-transform duration-200 ease-in-out lg:translate-x-0',
          isLg ? 'translate-x-0' : sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <NavLink
          to={ROUTES.DASHBOARD}
          end
          className="admin-sidebar-brand group flex h-[4.25rem] shrink-0 items-center gap-3 px-5 transition-opacity hover:opacity-90"
          title="Go to dashboard"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--neon-green)] shadow-sm shadow-[rgba(0,230,118,0.2)]">
            <span className="font-display text-base font-bold text-white">E</span>
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-[15px] font-bold tracking-tight text-white">EMPWR</p>
            <p className="truncate text-[11px] font-medium text-[var(--text-muted)]">Enterprise</p>
          </div>
        </NavLink>

        <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-5 pb-2">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="admin-sidebar-group-label mb-2.5 px-3">{g.label}</p>
              <div className="space-y-0.5">
                {g.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end ?? false}
                    onClick={() => !isLg && setSidebarOpen(false)}
                    className={({ isActive }) =>
                      cn('admin-sidebar-link', isActive && 'admin-sidebar-link-active')
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={cn(
                            'admin-sidebar-link-icon h-[18px] w-[18px] shrink-0 transition-colors',
                            isActive ? 'text-[var(--neon-green)]' : 'text-[var(--text-muted)]',
                          )}
                          strokeWidth={2}
                        />
                        <span className="truncate">{item.label}</span>
                        {item.notificationKey && (
                          <NotificationBadge
                            count={notificationCounts[item.notificationKey]}
                            size="sm"
                            className="right-2"
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
