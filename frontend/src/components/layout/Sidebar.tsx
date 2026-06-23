import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
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
import { motion, AnimatePresence } from 'framer-motion'
import { NavLink } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { ROUTES } from '@constants/routes'
import { useUiStore } from '@store/uiStore'
import { useAuthStore } from '@store/authStore'
import { useMediaQuery } from '@hooks/useMediaQuery'
import { useNotificationCounts } from '@hooks/useNotificationCounts'
import { NotificationBadge } from '@components/ui/NotificationBadge'
import { Avatar } from '@components/ui/Avatar'
import {
  resolveNavNotificationCount,
  type NotificationTabKey,
} from '@utils/notificationCategories'

export const ADMIN_SIDEBAR_WIDTH = 260
export const ADMIN_SIDEBAR_COLLAPSED_WIDTH = 72

const groups: {
  label: string
  items: {
    to: string
    label: string
    icon: typeof LayoutGrid
    end?: boolean
    notificationKey?: NotificationTabKey
    notificationBadgeKeys?: NotificationTabKey[]
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
      { to: ROUTES.TIMESHEET, label: 'Projects & Timesheets', icon: Clock, notificationKey: 'projects' },
      { to: ROUTES.CALENDAR, label: 'Company Calendar', icon: CalendarDays, notificationKey: 'calendar' },
    ],
  },
  {
    label: 'Company',
    items: [
      { to: ROUTES.PAYSLIPS, label: 'Payslips', icon: Receipt, notificationKey: 'payslips' },
      { to: ROUTES.TRAINING, label: 'Training & Courses', icon: BookOpen },
      { to: ROUTES.ACHIEVEMENTS, label: 'Company achievements', icon: Trophy },
      {
        to: ROUTES.DOCUMENTS,
        label: 'Documents Request',
        icon: FileText,
        notificationKey: 'documents',
      },
      { to: ROUTES.NEWS, label: 'Manage News', icon: Newspaper },
      { to: ROUTES.TICKETS, label: 'Tickets', icon: Ticket, notificationKey: 'tickets' },
    ],
  },
]

function NavItem({
  item,
  collapsed,
  counts,
  onNavigate,
}: {
  item: (typeof groups)[number]['items'][number]
  collapsed: boolean
  counts: ReturnType<typeof useNotificationCounts>['counts']
  onNavigate: () => void
}) {
  const Icon = item.icon
  const showBadge = item.notificationKey || item.notificationBadgeKeys?.length

  return (
    <NavLink
      to={item.to}
      end={item.end ?? false}
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'admin-sidebar-link',
          collapsed && 'justify-center px-2',
          isActive && 'admin-sidebar-link-active',
        )
      }
    >
      {({ isActive }) => {
        const notificationCount = resolveNavNotificationCount({
          notificationKey: item.notificationKey,
          notificationBadgeKeys: item.notificationBadgeKeys,
          isActive,
          counts,
        })

        return (
        <>
          <motion.span
            className="flex shrink-0 items-center justify-center"
            whileHover={{ scale: 1.08 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <Icon
              className={cn(
                'admin-sidebar-link-icon h-[18px] w-[18px] transition-colors',
                isActive ? 'text-[var(--neon-green)]' : 'text-[var(--text-muted)]',
              )}
              strokeWidth={2}
            />
          </motion.span>
          {!collapsed && <span className="truncate">{item.label}</span>}
          {!collapsed && showBadge && (
            <NotificationBadge
              count={notificationCount ?? 0}
              size="sm"
              className="right-2"
            />
          )}
        </>
        )
      }}
    </NavLink>
  )
}

export function Sidebar() {
  const isLg = useMediaQuery('(min-width: 1024px)')
  const user = useAuthStore((s) => s.user)
  const { sidebarOpen, setSidebarOpen, toggleSidebar, sidebarCollapsed, toggleSidebarCollapsed } =
    useUiStore()
  const { counts: notificationCounts } = useNotificationCounts()
  const showDrawer = !isLg && sidebarOpen
  const collapsed = isLg && sidebarCollapsed
  const sidebarWidth = collapsed ? ADMIN_SIDEBAR_COLLAPSED_WIDTH : ADMIN_SIDEBAR_WIDTH

  const closeMobile = () => !isLg && setSidebarOpen(false)

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
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      ) : null}

      <AnimatePresence>
        {showDrawer && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            aria-label="Close menu"
            className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-[2px] lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        style={{ width: sidebarWidth }}
        className={cn(
          'admin-sidebar sidebar-navigation fixed left-0 top-0 z-40 flex h-full flex-col transition-[width,transform] duration-300 ease-in-out lg:translate-x-0',
          isLg ? 'translate-x-0' : sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <NavLink
          to={ROUTES.DASHBOARD}
          end
          className={cn(
            'admin-sidebar-brand group flex h-[4.25rem] shrink-0 items-center gap-3 px-5 transition-opacity hover:opacity-90',
            collapsed && 'justify-center px-2',
          )}
          title="Go to dashboard"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--neon-green)] shadow-sm shadow-emerald-500/20 transition-transform group-hover:scale-[1.03]">
            <span className="font-display text-base font-bold text-white">E</span>
          </div>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className="min-w-0 leading-tight"
            >
              <p className="truncate font-display text-[15px] font-bold tracking-tight text-[var(--text-primary)]">
                EMPWR
              </p>
              <p className="truncate text-[11px] font-medium text-[var(--text-muted)]">Enterprise</p>
            </motion.div>
          )}
        </NavLink>

        <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-5 pb-2">
          {groups.map((g) => (
            <div key={g.label}>
              {!collapsed && (
                <p className="admin-sidebar-group-label mb-2.5 px-3">{g.label}</p>
              )}
              {collapsed && <div className="mx-auto mb-2 h-px w-8 bg-[var(--border-subtle)]" aria-hidden />}
              <div className="space-y-0.5">
                {g.items.map((item) => (
                  <NavItem
                    key={item.to}
                    item={item}
                    collapsed={collapsed}
                    counts={notificationCounts}
                    onNavigate={closeMobile}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-profile shrink-0 px-3 py-3">
          {!collapsed && user && (
            <div className="mb-2 flex items-center gap-2.5 rounded-xl px-2 py-2">
              <Avatar
                name={user.name ?? 'Admin'}
                src={user.avatarUrl}
                size="sm"
                color="#266b1c"
                className="!ring-0"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{user.name}</p>
                <p className="truncate text-[11px] text-[var(--text-muted)]">
                  {user.designation || user.role || 'Admin'}
                </p>
              </div>
            </div>
          )}
          {isLg && (
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              className={cn(
                'admin-sidebar-collapse-btn gap-1.5',
                collapsed ? 'mx-auto h-9 w-9' : 'h-9 w-full',
              )}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4" />
                  <span className="ml-1.5 text-xs font-medium">Collapse</span>
                </>
              )}
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
