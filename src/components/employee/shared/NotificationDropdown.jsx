import { Bell } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@components/employee/ui/dropdown-menu'
import { useNotificationStore } from '@store/employee/notificationStore'
import { cn } from '@pages/employee/lib/utils'

export function NotificationDropdown() {
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotificationStore()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="relative rounded-xl p-2 hover:bg-slate-100" aria-label="Notifications">
          <Bell className="h-5 w-5 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-heading font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <button type="button" onClick={markAllRead} className="text-xs text-primary hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.map((n) => (
            <DropdownMenuItem
              key={n.id}
              onClick={() => markAsRead(n.id)}
              className={cn('flex flex-col items-start gap-1 p-4 cursor-pointer', !n.read && 'bg-primary/5')}
            >
              <span className="font-medium text-foreground">{n.title}</span>
              <span className="text-xs text-muted">{n.message}</span>
              <span className="text-xs text-slate-400">{n.time}</span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
