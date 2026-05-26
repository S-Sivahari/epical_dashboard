import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Clock,
  CalendarOff,
  Calendar,
  FileText,
  GraduationCap,
  Trophy,
  HelpCircle,
  Ticket,
  User,
  X,
} from 'lucide-react'
import { cn } from '@pages/employee/lib/utils'
import { useUIStore } from '@store/employee/uiStore'
import { company } from '@pages/employee/data/mockData'
import { employeeNavGroups } from '@constants/employeeNav'

const SIDEBAR_WIDTH = 248
const SIDEBAR_COLLAPSED_WIDTH = 72

const navIcons = {
  '/employee': LayoutDashboard,
  '/employee/timesheet': Clock,
  '/employee/leave': CalendarOff,
  '/employee/calendar': Calendar,
  '/employee/documents': FileText,
  '/employee/training': GraduationCap,
  '/employee/achievements': Trophy,
  '/employee/profile': User,
  '/employee/tickets': Ticket,
  '/employee/help': HelpCircle,
}

function NavItem({ to, label, end, collapsed, onNavigate }) {
  const Icon = navIcons[to] ?? LayoutDashboard

  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium leading-snug transition-all duration-200',
          collapsed ? 'justify-center px-2' : '',
          isActive
            ? 'bg-primary text-white shadow-sm shadow-primary/20'
            : 'text-slate-600 hover:bg-slate-100/90 hover:text-slate-900',
        )
      }
    >
      {({ isActive }) => (
        <>
          {!collapsed && isActive && (
            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-white/90" aria-hidden />
          )}
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-200',
              isActive
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-primary',
            )}
          >
            <Icon className="h-[17px] w-[17px]" strokeWidth={2} />
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1 truncate pr-1">{label}</span>
          )}
        </>
      )}
    </NavLink>
  )
}

export function Sidebar() {
  const { sidebarCollapsed, sidebarMobileOpen, setSidebarMobileOpen } = useUIStore()

  const closeMobile = () => setSidebarMobileOpen(false)

  return (
    <>
      <AnimatePresence>
        {sidebarMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] lg:hidden"
            onClick={closeMobile}
          />
        )}
      </AnimatePresence>

      <aside
        style={{
          width: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        }}
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-slate-200/80 bg-white shadow-sm transition-[width,transform] duration-300 ease-in-out',
          sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            'flex h-[60px] shrink-0 items-center border-b border-slate-100',
            sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4',
          )}
        >
          <div className={cn('flex items-center gap-2.5 overflow-hidden', sidebarCollapsed && 'justify-center')}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-600 font-heading text-sm font-bold text-white shadow-sm">
              {company.logo}
            </div>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="min-w-0"
              >
                <p className="truncate font-heading text-sm font-semibold text-slate-900">
                  {company.name}
                </p>
                <p className="truncate text-[11px] font-medium text-slate-500">Employee Portal</p>
              </motion.div>
            )}
          </div>
          <button
            type="button"
            onClick={closeMobile}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3 scrollbar-thin">
          <div className={cn('space-y-4', sidebarCollapsed && 'space-y-2')}>
            {employeeNavGroups.map((group) => (
              <div key={group.label}>
                {!sidebarCollapsed && (
                  <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {group.label}
                  </p>
                )}
                {sidebarCollapsed && (
                  <div className="mx-auto mb-1.5 h-px w-8 bg-slate-200" aria-hidden />
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavItem
                      key={item.to}
                      to={item.to}
                      label={item.label}
                      end={item.end}
                      collapsed={sidebarCollapsed}
                      onNavigate={closeMobile}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Footer hint */}
        {!sidebarCollapsed && (
          <div className="shrink-0 border-t border-slate-100 px-4 py-3">
            <p className="text-[10px] leading-relaxed text-slate-400">
              Epical HRMS · Employee self-service
            </p>
          </div>
        )}
      </aside>
    </>
  )
}

export const employeeSidebarWidth = SIDEBAR_WIDTH
export const employeeSidebarCollapsedWidth = SIDEBAR_COLLAPSED_WIDTH
