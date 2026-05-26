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
  User,
  X,
} from 'lucide-react'
import { cn } from '@pages/employee/lib/utils'
import { useUIStore } from '@store/employee/uiStore'
import { company } from '@pages/employee/data/mockData'
import { employeeNavItems } from '@constants/employeeNav'

const basePath = '/employee'

const navIcons = {
  '/employee': LayoutDashboard,
  '/employee/timesheet': Clock,
  '/employee/leave': CalendarOff,
  '/employee/calendar': Calendar,
  '/employee/documents': FileText,
  '/employee/training': GraduationCap,
  '/employee/achievements': Trophy,
  '/employee/profile': User,
  '/employee/support': HelpCircle,
}

const navItems = employeeNavItems.map((item) => ({
  ...item,
  icon: navIcons[item.to],
}))

export function Sidebar() {
  const {
    sidebarCollapsed,
    sidebarMobileOpen,
    setSidebarMobileOpen,
  } = useUIStore()

  const content = (
    <>
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary font-heading text-lg font-bold text-white">
            {company.logo}
          </div>
          {!sidebarCollapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0">
              <p className="truncate font-heading text-sm font-bold">{company.name}</p>
              <p className="truncate text-xs text-muted">Employee Portal</p>
            </motion.div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSidebarMobileOpen(false)}
          className="lg:hidden rounded-lg p-1 hover:bg-slate-100"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3 scrollbar-thin">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === basePath}
            onClick={() => setSidebarMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted hover:bg-slate-100 hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-white')} />
                {!sidebarCollapsed && <span className="truncate">{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  )

  return (
    <>
      <AnimatePresence>
        {sidebarMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarMobileOpen(false)}
          />
        )}
      </AnimatePresence>
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-border bg-card transition-all duration-300',
          sidebarCollapsed ? 'w-[72px]' : 'w-64',
          sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {content}
      </aside>
    </>
  )
}
