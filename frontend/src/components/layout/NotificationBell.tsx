import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Bell } from 'lucide-react'
import { useEffect } from 'react'
import { useNotificationStore, NOTIFICATION_POLL_MS } from '@store/notificationStore'
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
    fetchUnreadCount()

    // Light poll: unread count only (full list loads on bell open or when count rises)
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
        <button
          type="button"
          className="relative flex items-center justify-center rounded-lg border border-zinc-700/50 bg-[#27272a] p-2 text-[#8892a4] transition-ui hover:border-zinc-600 hover:bg-[#3f3f46] hover:text-white"
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
          className="z-50 w-96 rounded-xl border border-zinc-700/50 bg-[#27272a] shadow-lg shadow-black/30"
          sideOffset={6}
          align="end"
        >
          <div className="border-b border-zinc-700/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead()}
                  className="text-xs text-[#4f8ef7] hover:underline"
                >
                  Mark all as read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {displayNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[#8892a4]">
                No notifications yet
              </div>
            ) : (
              <div className="divide-y divide-zinc-700/50">
                {displayNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-[#3f3f46] ${
                      !notification.isRead ? 'bg-[rgba(79,142,247,0.08)]' : ''
                    }`}
                    onClick={() => !notification.isRead && markAsRead(notification.id)}
                  >
                    <div
                      className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${
                        !notification.isRead ? 'bg-[#4f8ef7]' : 'bg-transparent'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-sm text-white">{notification.title}</h4>
                      <p className="text-sm text-[#8892a4] line-clamp-2">{notification.message}</p>
                      <span className="text-xs text-[#8892a4] mt-1 block">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNotification(notification.id)
                      }}
                      className="text-[#8892a4] hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {notifications.length > displayNotifications.length && (
            <div className="border-t border-zinc-700/50 px-4 py-2 text-center">
              <button
                type="button"
                className="text-sm text-[#4f8ef7] hover:underline"
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
