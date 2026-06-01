import { NavLink, useLocation } from 'react-router-dom'
import { ADMIN_NAV_ITEMS, isAdminNavActive } from '@constants/adminNavigation'
import { useNotificationCounts } from '@hooks/useNotificationCounts'
import { useLeaves } from '@hooks/useLeaves'
import { NotificationBadge } from '@components/ui/NotificationBadge'
import { cn } from '@/utils/cn'

export function AdminTopNav() {
  const { pathname } = useLocation()
  const { counts: notificationCounts } = useNotificationCounts()
  const { leaves } = useLeaves()
  const pendingLeaves = leaves.filter((l) => l.status === 'Pending').length

  return (
    <nav
      className="admin-top-nav admin-top-nav-refined shrink-0 border-b border-[rgba(38,107,28,0.12)]"
      aria-label="Admin navigation"
    >
      <div className="admin-top-nav-spread">
        {ADMIN_NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isAdminNavActive(pathname, item.to, item.end)
          const notificationCount =
            item.notificationKey === 'leaves'
              ? Math.max(notificationCounts.leaves ?? 0, pendingLeaves)
              : item.notificationKey
                ? notificationCounts[item.notificationKey]
                : undefined
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
