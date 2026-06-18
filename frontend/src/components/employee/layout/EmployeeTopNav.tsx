import { NavLink, useLocation } from 'react-router-dom'
import { useMemo } from 'react'
import {
  EMPLOYEE_NAV_ITEMS,
  EMPLOYEE_NOTES_NAV_ITEM,
  isEmployeeNavActive,
} from '@constants/employeeNavigation'
import { useNotificationCounts } from '@hooks/useNotificationCounts'
import { useEmployeeNotesAccess } from '@hooks/useEmployeeNotesAccess'
import { resolveNavNotificationCount } from '@utils/notificationCategories'
import { NotificationBadge } from '@components/ui/NotificationBadge'
import { cn } from '@/utils/cn'

export function EmployeeTopNav() {
  const { pathname } = useLocation()
  const { counts: notificationCounts } = useNotificationCounts()
  const { showNotesNav } = useEmployeeNotesAccess()

  const navItems = useMemo(() => {
    if (!showNotesNav) return EMPLOYEE_NAV_ITEMS
    const items = [...EMPLOYEE_NAV_ITEMS]
    const timesheetIndex = items.findIndex((item) => item.to === '/employee/timesheet')
    const insertAt = timesheetIndex >= 0 ? timesheetIndex + 1 : 2
    items.splice(insertAt, 0, EMPLOYEE_NOTES_NAV_ITEM)
    return items
  }, [showNotesNav])

  return (
    <nav
      className="admin-top-nav admin-top-nav-refined shrink-0"
      aria-label="Employee navigation"
    >
      <div className="admin-top-nav-spread">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isEmployeeNavActive(pathname, item.to, item.end)
          const notificationCount = resolveNavNotificationCount({
            notificationKey: item.notificationKey,
            isActive: active,
            counts: notificationCounts,
          })
          const displayLabel = item.navLabel ?? item.label

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={cn('admin-top-nav-link relative', active && 'admin-top-nav-link-active')}
            >
              <span className="relative inline-flex shrink-0">
                <Icon className="admin-top-nav-link-icon h-[1.125rem] w-[1.125rem]" strokeWidth={2} />
                {item.notificationKey ? (
                  <NotificationBadge count={notificationCount ?? 0} size="sm" className="-right-1 -top-1" />
                ) : null}
              </span>
              <span className="admin-top-nav-link-text">{displayLabel}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
