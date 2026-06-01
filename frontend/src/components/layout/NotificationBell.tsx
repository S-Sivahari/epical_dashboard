import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Bell } from 'lucide-react'
import { useEffect } from 'react'
import { useNotificationStore, NOTIFICATION_POLL_MS } from '@store/notificationStore'
import { formatDistanceToNow } from 'date-fns'

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    fetchNotificationsSilent,
    fetchUnreadCount,
    fetchUnreadCountSilent,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationStore()

  useEffect(() => {
    fetchUnreadCount()

    const interval = setInterval(() => {
      fetchUnreadCountSilent()
    }, NOTIFICATION_POLL_MS)
    return () => clearInterval(interval)
  }, [fetchUnreadCount, fetchUnreadCountSilent])

  const displayNotifications = notifications.slice(0, 5)

  return (
    <DropdownMenu.Root
      onOpenChange={(open) => {
        if (open) fetchNotificationsSilent()
      }}
    >
      <DropdownMenu.Trigger asChild>
        <button type="button" className="admin-navbar-icon-btn relative p-2" title="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#22c55e] text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className="admin-navbar-menu z-50 w-96" sideOffset={6} align="end">
          <div className="border-b border-zinc-700/40 px-4 py-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead()}
                  className="text-xs text-[#22c55e] hover:underline"
                >
                  Mark all as read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {displayNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[#71717a]">No notifications yet</div>
            ) : (
              <div className="divide-y divide-zinc-700/40">
                {displayNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-white/5 ${
                      !notification.isRead ? 'bg-[rgba(34,197,94,0.08)]' : ''
                    }`}
                    onClick={() => !notification.isRead && markAsRead(notification.id)}
                  >
                    <div
                      className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${
                        !notification.isRead ? 'bg-[#22c55e]' : 'bg-transparent'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium text-white">{notification.title}</h4>
                      <p className="line-clamp-2 text-sm text-[#71717a]">{notification.message}</p>
                      <span className="mt-1 block text-xs text-[#71717a]">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNotification(notification.id)
                      }}
                      className="text-[#71717a] transition-colors hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {notifications.length > displayNotifications.length && (
            <div className="border-t border-zinc-700/40 px-4 py-2 text-center">
              <button type="button" className="text-sm text-[#22c55e] hover:underline">
                View all notifications
              </button>
            </div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
