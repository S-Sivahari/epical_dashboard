import { Bell, History } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@components/employee/ui/dropdown-menu'
import { useNotificationStore, NOTIFICATION_POLL_MS } from '@store/notificationStore'
import { getNotificationRoute } from '@utils/notificationNavigation'
import { cn } from '@pages/employee/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { NotificationHistoryDialog } from '@components/layout/NotificationHistoryDialog'

export function NotificationDropdown() {
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const {
    notifications,
    unreadCount,
    fetchNotificationsSilent,
    fetchUnreadCount,
    fetchUnreadCountSilent,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
  } = useNotificationStore()

  useEffect(() => {
    fetchUnreadCount()

    const interval = setInterval(() => {
      fetchUnreadCountSilent()
    }, NOTIFICATION_POLL_MS)
    return () => clearInterval(interval)
  }, [fetchUnreadCount, fetchUnreadCountSilent])

  const handleNotificationClick = async (notification) => {
    const route = getNotificationRoute(notification)
    setDropdownOpen(false)
    if (route) navigate(route)
  }

  const openHistory = () => {
    setDropdownOpen(false)
    setHistoryOpen(true)
  }

  return (
    <>
      <DropdownMenu
        open={dropdownOpen}
        onOpenChange={(open) => {
          setDropdownOpen(open)
          if (open) fetchNotificationsSilent()
        }}
      >
        <DropdownMenuTrigger asChild>
          <button type="button" className="relative rounded-xl p-2 hover:bg-slate-100" aria-label="Notifications">
            <Bell className="h-5 w-5 text-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="notification-dropdown-panel w-80 border border-border p-0 shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <span className="font-heading font-semibold">Notifications</span>
            <div className="notification-dropdown-actions flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={openHistory}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <History className="h-3.5 w-3.5" />
                History
              </button>
              {notifications.length > 0 && (
                <>
                  {unreadCount > 0 && (
                    <button type="button" onClick={() => void markAllAsRead()} className="text-xs text-primary hover:underline">
                      Mark all read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void deleteAllNotifications()}
                    className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline"
                  >
                    Clear all
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted">
                No notifications yet
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.slice(0, 5).map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      'notification-dropdown-item flex cursor-pointer items-start gap-3 px-4 py-3',
                      !n.isRead ? 'notification-dropdown-item--unread' : 'notification-dropdown-item--read',
                    )}
                    onClick={() => void handleNotificationClick(n)}
                  >
                    <div
                      className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${
                        !n.isRead ? 'bg-primary' : 'bg-transparent'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-sm text-foreground">{n.title}</h4>
                      <p className="text-sm text-muted line-clamp-2">{n.message}</p>
                      <span className="text-xs text-slate-400 mt-1 block">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNotification(n.id)
                      }}
                      className="text-xs text-muted hover:text-foreground ml-2"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-border px-4 py-2 text-center">
            <button
              type="button"
              onClick={openHistory}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <History className="h-3.5 w-3.5" />
              Notification History
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <NotificationHistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </>
  )
}
