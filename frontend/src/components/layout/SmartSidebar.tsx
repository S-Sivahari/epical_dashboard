import {
  BookOpen,
  Briefcase,
  CalendarCheck,
  Clock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutGrid,
  Menu,
  Newspaper,
  Pin,
  PinOff,
  Receipt,
  Ticket,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { NavLink } from 'react-router-dom'
import { useState } from 'react'
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

export const SMART_SIDEBAR_COLLAPSED = 72
export const SMART_SIDEBAR_EXPANDED = 248

const navItems: {
  to: string
  label: string
  icon: typeof LayoutGrid
  end?: boolean
  notificationKey?: NotificationTabKey
  notificationBadgeKeys?: NotificationTabKey[]
}[] = [
  { to: ROUTES.DASHBOARD, label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: ROUTES.EMPLOYEES, label: 'Employees', icon: Users, end: true },
  { to: ROUTES.LEAVES, label: 'Leaves', icon: CalendarCheck, notificationKey: 'leaves' },
  { to: ROUTES.TIMESHEET, label: 'Projects & Timesheets', icon: Clock, notificationKey: 'projects' },
  { to: ROUTES.CALENDAR, label: 'Calendar', icon: CalendarDays, notificationKey: 'calendar' },
  { to: ROUTES.TICKETS, label: 'Tickets', icon: Ticket, notificationKey: 'tickets' },
  { to: ROUTES.PAYSLIPS, label: 'Payslips', icon: Receipt, notificationKey: 'payslips' },
  { to: ROUTES.TRAINING, label: 'Training', icon: BookOpen },
  { to: ROUTES.ACHIEVEMENTS, label: 'Achievements', icon: Trophy },
  { to: ROUTES.DOCUMENTS, label: 'Documents', icon: FileText, notificationKey: 'documents' },
  { to: ROUTES.NEWS, label: 'News', icon: Newspaper },
]

function NavItem({
  item,
  expanded,
  counts,
  onNavigate,
}: {
  item: (typeof navItems)[number]
  expanded: boolean
  counts: ReturnType<typeof useNotificationCounts>['counts']
  onNavigate: () => void
}) {
  const Icon = item.icon
  const showBadge = item.notificationKey || item.notificationBadgeKeys?.length

  return (
    <NavLink
      to={item.to}
      end={item.end ?? false}
      title={!expanded ? item.label : undefined}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn('cmd-nav-item', !expanded && 'cmd-nav-item-collapsed', isActive && 'cmd-nav-item-active')
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
            className="cmd-nav-icon-wrap"
            whileHover={{ scale: 1.06 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          >
            <Icon
              className={cn('h-[18px] w-[18px]', isActive ? 'text-[var(--green-600)]' : 'text-[var(--text-muted)]')}
              strokeWidth={2}
            />
          </motion.span>
          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="truncate text-sm font-medium"
              >
                {item.label}
              </motion.span>
            )}
          </AnimatePresence>
          {expanded && showBadge && (
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

export function SmartSidebar() {
  const isLg = useMediaQuery('(min-width: 1024px)')
  const user = useAuthStore((s) => s.user)
  const { sidebarOpen, setSidebarOpen, toggleSidebar, sidebarCollapsed, toggleSidebarCollapsed } =
    useUiStore()
  const { counts: notificationCounts } = useNotificationCounts()
  const [hoverExpanded, setHoverExpanded] = useState(false)
  const [pinned, setPinned] = useState(false)

  const showDrawer = !isLg && sidebarOpen
  const expanded = isLg ? (!sidebarCollapsed || hoverExpanded || pinned) : true
  const sidebarWidth = expanded ? SMART_SIDEBAR_EXPANDED : SMART_SIDEBAR_COLLAPSED

  const closeMobile = () => !isLg && setSidebarOpen(false)

  return (
    <>
      {!isLg ? (
        <button
          type="button"
          className="cmd-mobile-toggle fixed left-4 top-4 z-40 lg:hidden"
          onClick={toggleSidebar}
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      ) : null}

      <AnimatePresence>
        {showDrawer && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Close menu"
            className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-[2px] lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        style={{ width: isLg ? sidebarWidth : SMART_SIDEBAR_EXPANDED }}
        onMouseEnter={() => isLg && sidebarCollapsed && !pinned && setHoverExpanded(true)}
        onMouseLeave={() => isLg && setHoverExpanded(false)}
        className={cn(
          'cmd-sidebar fixed left-3 top-3 z-40 flex flex-col transition-[width,transform] duration-300 ease-out lg:bottom-3 lg:h-auto lg:rounded-2xl',
          isLg ? 'translate-x-0' : sidebarOpen ? 'translate-x-0' : '-translate-x-[110%]',
          !isLg && 'bottom-3 h-[calc(100vh-1.5rem)] rounded-2xl',
        )}
      >
        <NavLink
          to={ROUTES.DASHBOARD}
          end
          className={cn(
            'cmd-sidebar-brand flex shrink-0 items-center gap-3 px-4 py-3',
            !expanded && 'justify-center px-2',
          )}
        >
          <div className="cmd-brand-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
            <span className="font-display text-base font-bold text-white">E</span>
          </div>
          {expanded && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0">
              <p className="truncate font-display text-[15px] font-bold tracking-tight">EMPWR</p>
              <p className="truncate text-xs font-medium text-[var(--text-muted)]">Dashboard</p>
            </motion.div>
          )}
        </NavLink>

        <nav className="cmd-nav-list min-h-0 flex-1 overflow-hidden px-2.5 py-1">
          {navItems.map((item) => (
            <NavItem
              key={item.to}
              item={item}
              expanded={expanded}
              counts={notificationCounts}
              onNavigate={closeMobile}
            />
          ))}
        </nav>

        <div className="shrink-0 border-t border-[var(--border-subtle)] px-2.5 py-2">
          {expanded && user && (
            <div className="mb-1.5 flex items-center gap-2 rounded-xl px-2 py-1.5">
              <Avatar name={user.name ?? 'Admin'} src={user.avatarUrl} size="sm" color="#266b1c" className="!ring-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-[11px] text-[var(--text-muted)]">{user.designation || 'Admin'}</p>
              </div>
            </div>
          )}
          {isLg && (
            <div className={cn('flex gap-1', !expanded && 'flex-col items-center')}>
              <button
                type="button"
                onClick={() => {
                  if (pinned) setPinned(false)
                  else {
                    setPinned(true)
                    if (sidebarCollapsed) toggleSidebarCollapsed()
                  }
                }}
                className="cmd-sidebar-ctrl"
                aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
                title={pinned ? 'Unpin' : 'Pin expanded'}
              >
                {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={toggleSidebarCollapsed}
                className="cmd-sidebar-ctrl flex-1"
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                {expanded && <span className="ml-1 text-xs font-medium">Collapse</span>}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
