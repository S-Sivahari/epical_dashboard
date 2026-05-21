import { AlertCircle, CheckCircle, XCircle, Bell } from 'lucide-react'
import { useEffect } from 'react'
import { useNotificationStore } from '@store/notificationStore'

export function NotificationAlerts() {
  const { notifications, fetchNotifications, fetchNotificationsSilent } = useNotificationStore()

  useEffect(() => {
    // Fetch notifications immediately on mount
    fetchNotifications()

    // Set up auto-refresh every 5 seconds for real-time updates WITHOUT loading indicator
    const interval = setInterval(() => {
      fetchNotificationsSilent()
    }, 5000)

    // Cleanup interval on unmount
    return () => clearInterval(interval)
  }, [fetchNotifications, fetchNotificationsSilent])

  const leaveNotifications = notifications.filter((n) =>
    ['LeaveApproved', 'LeaveRejected', 'LeaveSubmitted'].includes(n.type)
  )

  if (leaveNotifications.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {leaveNotifications.slice(0, 5).map((notification) => {
        const isApproved = notification.type === 'LeaveApproved'
        const isRejected = notification.type === 'LeaveRejected'
        const isSubmitted = notification.type === 'LeaveSubmitted'

        let icon = Bell
        let bgColor = 'bg-blue-50'
        let borderColor = 'border-blue-200'
        let textColor = 'text-blue-900'
        let titleColor = 'text-blue-700'

        if (isApproved) {
          icon = CheckCircle
          bgColor = 'bg-green-50'
          borderColor = 'border-green-200'
          textColor = 'text-green-900'
          titleColor = 'text-green-700'
        } else if (isRejected) {
          icon = XCircle
          bgColor = 'bg-red-50'
          borderColor = 'border-red-200'
          textColor = 'text-red-900'
          titleColor = 'text-red-700'
        }

        const Icon = icon

        return (
          <div
            key={notification.id}
            className={`flex gap-3 rounded-lg border ${borderColor} ${bgColor} p-4`}
          >
            <Icon className={`h-5 w-5 flex-shrink-0 ${titleColor} mt-0.5`} />
            <div className="flex-1 min-w-0">
              <h4 className={`font-semibold text-sm ${titleColor}`}>{notification.title}</h4>
              <p className={`text-sm ${textColor} mt-1`}>{notification.message}</p>
              {!notification.isRead && (
                <span className="inline-block mt-2 text-xs font-medium px-2 py-1 rounded bg-white/50">
                  New
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
