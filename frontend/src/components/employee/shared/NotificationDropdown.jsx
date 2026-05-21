import { Bell } from 'lucide-react'
import { useEffect } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@components/employee/ui/dropdown-menu'
import { useNotificationStore } from '@store/notificationStore'
import { cn } from '@pages/employee/lib/utils'
import { formatDistanceToNow } from 'date-fns'

export function NotificationDropdown() {
  const { notifications, unreadCount, fetchNotifications, fetchUnreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotificationStore()

  useEffect(() => {
    fetchUnreadCount()
    fetchNotifications()
    // Refresh every 5 seconds for real-time updates
    const interval = setInterval(() => {
      fetchUnreadCount()
      fetchNotifications()
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchNotifications, fetchUnreadCount])

  return (
    <DropdownMenu>
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
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-heading font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <button type="button" onClick={() => markAllAsRead()} className="text-xs text-primary hover:underline">
              Mark all as read
            </button>
          )}
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
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer ${
                    !n.isRead ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => !n.isRead && markAsRead(n.id)}
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
