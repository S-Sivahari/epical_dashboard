import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Bell } from 'lucide-react'
import { useEffect } from 'react'
import { useNotificationStore } from '@store/notificationStore'
import { formatDistanceToNow } from 'date-fns'

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    fetchNotificationsSilent,
    fetchUnreadCount,
    fetchUnreadCountSilent,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationStore()

  useEffect(() => {
    // Initial fetch with loading indicator
    fetchUnreadCount()
    fetchNotifications()
    
    // Poll for updates every 5 seconds WITHOUT loading indicator
    const interval = setInterval(() => {
      fetchUnreadCountSilent()
      fetchNotificationsSilent()
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchNotifications, fetchNotificationsSilent, fetchUnreadCount, fetchUnreadCountSilent])

  const displayNotifications = notifications.slice(0, 5)

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="relative flex items-center justify-center rounded-lg border border-border bg-white p-2 text-muted hover:bg-surface transition-ui"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-xs font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 w-96 rounded-xl border border-border bg-white shadow-lg"
          sideOffset={6}
          align="end"
        >
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead()}
                  className="text-xs text-primary hover:underline"
                >
                  Mark all as read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {displayNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted">
                No notifications yet
              </div>
            ) : (
              <div className="divide-y divide-border">
                {displayNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-surface transition-colors cursor-pointer ${
                      !notification.isRead ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => !notification.isRead && markAsRead(notification.id)}
                  >
                    <div
                      className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${
                        !notification.isRead ? 'bg-primary' : 'bg-transparent'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-sm text-ink">{notification.title}</h4>
                      <p className="text-sm text-muted line-clamp-2">{notification.message}</p>
                      <span className="text-xs text-muted-dark mt-1 block">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNotification(notification.id)
                      }}
                      className="text-muted hover:text-danger transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {notifications.length > displayNotifications.length && (
            <div className="border-t border-border px-4 py-2 text-center">
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => {
                  // Could navigate to notifications page
                }}
              >
                View all notifications
              </button>
            </div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
