import type { NotificationData } from '@store/notificationStore'
import { ROUTES } from '@constants/routes'

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
        return ROUTES.PROJECT_ANALYSIS_PROJECT_CELL(relatedData.projectId, relatedData.cellId)
      }
      return relatedData?.projectId
        ? ROUTES.PROJECT_ANALYSIS_PROJECT_WORKSPACE(relatedData.projectId)
        : ROUTES.PROJECT_ANALYSIS_PROJECTS
    case 'LibraryCreated':
    case 'CellCreatedUnassigned':
      if (recipientType === 'Admin' && relatedData?.projectId && relatedData?.cellId) {
        return ROUTES.PROJECT_ANALYSIS_PROJECT_CELL(relatedData.projectId, relatedData.cellId)
      }
      if (recipientType === 'Admin' && relatedData?.projectId) {
        return ROUTES.PROJECT_ANALYSIS_PROJECT_WORKSPACE(relatedData.projectId)
      }
      if (relatedData?.projectId && relatedData?.cellId) {
        return ROUTES.EMPLOYEE_PROJECT_ANALYSIS_PROJECT_CELL(relatedData.projectId, relatedData.cellId)
      }
      return relatedData?.projectId
        ? ROUTES.EMPLOYEE_PROJECT_ANALYSIS_PROJECT_WORKSPACE(relatedData.projectId)
        : ROUTES.EMPLOYEE_PROJECT_ANALYSIS_PROJECTS
    case 'CellReviewApproved':
    case 'CellReviewRejected':
      if (relatedData?.projectId && relatedData?.cellId) {
        return ROUTES.EMPLOYEE_PROJECT_ANALYSIS_PROJECT_CELL(relatedData.projectId, relatedData.cellId)
      }
      return relatedData?.projectId
        ? ROUTES.EMPLOYEE_PROJECT_ANALYSIS_PROJECT_WORKSPACE(relatedData.projectId)
        : ROUTES.EMPLOYEE_PROJECT_ANALYSIS_PROJECTS
    case 'CellAssigned':
      if (relatedData?.projectId && relatedData?.cellId) {
        return ROUTES.EMPLOYEE_PROJECT_ANALYSIS_PROJECT_CELL(relatedData.projectId, relatedData.cellId)
      }
      return relatedData?.projectId
        ? ROUTES.EMPLOYEE_PROJECT_ANALYSIS_PROJECT_WORKSPACE(relatedData.projectId)
        : ROUTES.EMPLOYEE_PROJECT_ANALYSIS_PROJECTS
    case 'NotesDelegationAssigned':
    case 'NotesDelegationMorning':
      return ROUTES.EMPLOYEE_PROJECT_ANALYSIS_NOTES
    default:
      return null
  }
}
