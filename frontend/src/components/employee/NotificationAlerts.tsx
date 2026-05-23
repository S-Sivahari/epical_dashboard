import { CheckCircle, XCircle, Bell, FileText, Calendar, CalendarOff } from 'lucide-react'
import { useEffect } from 'react'
import { useNotificationStore } from '@store/notificationStore'

export function NotificationAlerts() {
  const { notifications, fetchNotifications, fetchNotificationsSilent } = useNotificationStore()

  useEffect(() => {
    fetchNotifications()

    const interval = setInterval(() => {
      fetchNotificationsSilent()
    }, 5000)

    return () => clearInterval(interval)
  }, [fetchNotifications, fetchNotificationsSilent])

  const alertNotifications = notifications.filter((n) =>
    ['LeaveApproved', 'LeaveRejected', 'LeaveSubmitted', 'LeaveCancelled', 'PayslipSent',
      'HolidayAdded', 'HolidayUpdated', 'HolidayDeleted', 'HolidaySkipped'].includes(n.type)
  )

  if (alertNotifications.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {alertNotifications.slice(0, 5).map((notification) => {
        const isApproved = notification.type === 'LeaveApproved'
        const isRejected = notification.type === 'LeaveRejected'
        const isPayslip = notification.type === 'PayslipSent'
        const isCancelled = notification.type === 'LeaveCancelled'
        const isHolidayAdded = notification.type === 'HolidayAdded'
        const isHolidayDeleted = notification.type === 'HolidayDeleted'
        const isHolidaySkipped = notification.type === 'HolidaySkipped'
        const isHolidayUpdated = notification.type === 'HolidayUpdated'

        let Icon = Bell
        let bgColor = 'bg-blue-50'
        let borderColor = 'border-blue-200'
        let textColor = 'text-blue-900'
        let titleColor = 'text-blue-700'

        if (isApproved) {
          Icon = CheckCircle
          bgColor = 'bg-green-50'
          borderColor = 'border-green-200'
          textColor = 'text-green-900'
          titleColor = 'text-green-700'
        } else if (isRejected) {
          Icon = XCircle
          bgColor = 'bg-red-50'
          borderColor = 'border-red-200'
          textColor = 'text-red-900'
          titleColor = 'text-red-700'
        } else if (isCancelled) {
          Icon = XCircle
          bgColor = 'bg-orange-50'
          borderColor = 'border-orange-200'
          textColor = 'text-orange-900'
          titleColor = 'text-orange-700'
        } else if (isPayslip) {
          Icon = FileText
          bgColor = 'bg-indigo-50'
          borderColor = 'border-indigo-200'
          textColor = 'text-indigo-900'
          titleColor = 'text-indigo-700'
        } else if (isHolidayAdded || isHolidayUpdated) {
          Icon = Calendar
          bgColor = 'bg-green-50'
          borderColor = 'border-green-200'
          textColor = 'text-green-900'
          titleColor = 'text-green-700'
        } else if (isHolidayDeleted) {
          Icon = CalendarOff
          bgColor = 'bg-red-50'
          borderColor = 'border-red-200'
          textColor = 'text-red-900'
          titleColor = 'text-red-700'
        } else if (isHolidaySkipped) {
          Icon = CalendarOff
          bgColor = 'bg-amber-50'
          borderColor = 'border-amber-200'
          textColor = 'text-amber-900'
          titleColor = 'text-amber-700'
        }

        return (
          <div
            key={notification.id}
            className={`flex gap-3 rounded-lg border ${borderColor} ${bgColor} p-4`}
          >
            <Icon className={`h-5 w-5 flex-shrink-0 ${titleColor} mt-0.5`} />
            <div className="flex-1 min-w-0">
              <h4 className={`font-semibold text-sm ${titleColor}`}>{notification.title}</h4>
              <p className={`text-sm ${textColor} mt-1`}>{notification.message}</p>
              {isPayslip && notification.relatedData?.payMonth && (
                <p className={`text-xs ${textColor} mt-1 opacity-75`}>
                  Pay Period: {notification.relatedData.payMonth}
                </p>
              )}
              {isHolidaySkipped && notification.relatedData?.skippedReason && (
                <p className={`text-xs ${textColor} mt-1 opacity-75`}>
                  Reason: {notification.relatedData.skippedReason}
                </p>
              )}
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
