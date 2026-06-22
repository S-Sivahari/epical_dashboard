import { NavLink, useLocation } from 'react-router-dom'
import { ADMIN_NAV_ITEMS, isAdminNavActive } from '@constants/adminNavigation'
import { useNotificationCounts } from '@hooks/useNotificationCounts'
import { resolveNavNotificationCount } from '@utils/notificationCategories'
import { NotificationBadge } from '@components/ui/NotificationBadge'
import { cn } from '@/utils/cn'

export function AdminTopNav() {
  const { pathname } = useLocation()
  const { counts: notificationCounts } = useNotificationCounts()

  return (
    <nav
      className="admin-top-nav admin-top-nav-refined shrink-0"
      aria-label="Admin navigation"
    >
      <div className="admin-top-nav-spread">
        {ADMIN_NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isAdminNavActive(pathname, item.to, item.end)
          const notificationCount = resolveNavNotificationCount({
            notificationKey: item.notificationKey,
            notificationBadgeKeys: item.notificationBadgeKeys,
            isActive: active,
            counts: notificationCounts,
          })
          const displayLabel = item.navLabel ?? item.label
          const showBadge = item.notificationKey || item.notificationBadgeKeys?.length

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={cn('admin-top-nav-link relative', active && 'admin-top-nav-link-active')}
            >
              <span className="relative inline-flex shrink-0">
                <Icon className="admin-top-nav-link-icon shrink-0" strokeWidth={2} />
                {showBadge ? (
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
