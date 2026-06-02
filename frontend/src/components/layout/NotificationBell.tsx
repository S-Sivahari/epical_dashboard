import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Bell } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useNotificationStore, NOTIFICATION_POLL_MS, type NotificationData } from '@store/notificationStore'
import { getNotificationRoute } from '@utils/notificationNavigation'
import { formatDistanceToNow } from 'date-fns'

export function NotificationBell() {
  const navigate = useNavigate()
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

  const handleNotificationClick = async (notification: NotificationData) => {
    const route = getNotificationRoute(notification)
    await deleteNotification(notification.id)
    if (route) navigate(route)
  }

  return (
    <DropdownMenu.Root
      onOpenChange={(open) => {
        if (open) fetchNotificationsSilent()
      }}
    >
      <DropdownMenu.Trigger asChild>
        <button type="button" className="cmd-bar-icon-btn relative p-2" title="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className="cmd-dropdown z-50 w-96 overflow-hidden" sideOffset={6} align="end">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="border-b border-[var(--border-subtle)] px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[var(--text-primary)]">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllAsRead()}
                    className="text-xs font-medium text-[var(--text-link)] hover:text-[var(--text-link-hover)] hover:underline"
                  >
                    Mark all as read
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {displayNotifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                  No notifications yet
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {displayNotifications.map((notification, i) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.25 }}
                      className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--emerald-surface)] ${
                        !notification.isRead ? 'bg-[var(--emerald-surface)]' : 'bg-white'
                      }`}
                      onClick={() => void handleNotificationClick(notification)}
                    >
                      <div
                        className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${
                          !notification.isRead ? 'bg-primary' : 'bg-transparent'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className={`text-sm font-medium ${notification.isRead ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
                          {notification.title}
                        </h4>
                        <p className="line-clamp-2 text-sm text-[var(--text-secondary)]">
                          {notification.message}
                        </p>
                        <span className="mt-1 block text-xs text-[var(--text-muted)]">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteNotification(notification.id)
                        }}
                        className="text-[var(--text-muted)] transition-colors hover:text-[var(--emerald-dark)]"
                      >
                        ✕
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {notifications.length > displayNotifications.length && (
              <div className="border-t border-[var(--border-subtle)] px-4 py-2 text-center">
                <button type="button" className="text-sm font-medium text-[var(--text-link)] hover:text-[var(--text-link-hover)] hover:underline">
                  View all notifications
                </button>
              </div>
            )}
          </motion.div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
