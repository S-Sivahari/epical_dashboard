import type { NotificationData } from '@store/notificationStore'

export function getNotificationRoute(notification: NotificationData): string | null {
  const { type, relatedData, recipientType } = notification

  switch (type) {
    case 'PayslipSent':
    case 'PayslipRegenerated': {
      if (recipientType === 'Admin') {
        const params = new URLSearchParams({ tab: 'upload' })
        if (relatedData?.batchId) params.set('batchId', relatedData.batchId)
        return `/admin/payslips?${params.toString()}`
      }
      return '/employee/documents?tab=payslips'
    }
    case 'LeaveSubmitted':
      return '/admin/leaves'
    case 'LeaveApproved':
    case 'LeaveRejected':
    case 'LeaveCancelled':
      return '/employee/leave'
    case 'DocumentRequested':
      return '/admin/documents'
    case 'DocumentApproved':
    case 'DocumentRejected':
      return '/employee/documents?tab=requests'
    case 'HolidayAdded':
    case 'HolidayUpdated':
    case 'HolidayDeleted':
    case 'HolidaySkipped':
      return recipientType === 'Admin' ? '/admin/calendar' : '/employee/calendar'
    default:
      return null
  }
}
