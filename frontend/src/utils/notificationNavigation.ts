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
    case 'CalendarEventAdded':
    case 'CalendarEventUpdated':
    case 'CalendarEventRemoved':
      return recipientType === 'Admin' ? '/admin/calendar' : '/employee/calendar'
    case 'TicketSubmitted':
      return '/admin/tickets'
    case 'TicketStatusUpdated':
    case 'TicketCommentAdded':
      return '/employee/tickets'
    case 'CellReviewRequested':
      if (relatedData?.projectId && relatedData?.cellId) {
        return `/admin/projects/${relatedData.projectId}/cells/${relatedData.cellId}`
      }
      return relatedData?.projectId ? `/admin/projects/${relatedData.projectId}` : '/admin/projects'
    case 'CellReviewApproved':
    case 'CellReviewRejected':
      if (relatedData?.projectId && relatedData?.cellId) {
        return `/employee/projects/${relatedData.projectId}/cells/${relatedData.cellId}`
      }
      return relatedData?.projectId ? `/employee/projects/${relatedData.projectId}` : '/employee/projects'
    case 'CellCreatedUnassigned':
      if (recipientType === 'Admin' && relatedData?.projectId && relatedData?.cellId) {
        return `/admin/projects/${relatedData.projectId}/cells/${relatedData.cellId}`
      }
      if (relatedData?.projectId && relatedData?.cellId) {
        return `/employee/projects/${relatedData.projectId}/cells/${relatedData.cellId}`
      }
      return relatedData?.projectId ? `/employee/projects/${relatedData.projectId}` : '/employee/projects'
    case 'CellAssigned':
      if (relatedData?.projectId && relatedData?.cellId) {
        return `/employee/projects/${relatedData.projectId}/cells/${relatedData.cellId}`
      }
      return relatedData?.projectId ? `/employee/projects/${relatedData.projectId}` : '/employee/projects'
    default:
      return null
  }
}
