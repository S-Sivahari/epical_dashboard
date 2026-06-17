import type { NotificationData } from '@store/notificationStore'
import type { NotificationCounts } from '@services/notificationService'

export type NotificationCategory = 'leaves' | 'documents' | 'other'
export type TabIndicatorCounts = Pick<NotificationCounts, 'leaves' | 'documents'>

export const EMPTY_TAB_INDICATORS: TabIndicatorCounts = { leaves: 0, documents: 0 }

export function getNotificationCategory(type: NotificationData['type']): NotificationCategory {
  if (type.startsWith('Leave')) return 'leaves'
  if (type.startsWith('Document') || type.startsWith('Payslip')) return 'documents'
  return 'other'
}

/** Notification types that should be marked read when the user visits a route. */
export function getNotificationTypesForPath(pathname: string): NotificationData['type'][] {
  const path = pathname.replace(/\/+$/, '') || '/'

  if (path === '/admin/leaves' || path.startsWith('/admin/leaves/')) {
    return ['LeaveSubmitted']
  }
  if (path === '/admin/documents' || path.startsWith('/admin/documents/')) {
    return ['DocumentRequested']
  }
  if (path === '/admin/payslips' || path.startsWith('/admin/payslips/')) {
    return ['PayslipSent', 'PayslipRegenerated']
  }
  if (path === '/admin/tickets' || path.startsWith('/admin/tickets/')) {
    return ['TicketSubmitted']
  }
  if (path.startsWith('/admin/calendar')) {
    return [
      'HolidayAdded',
      'HolidayUpdated',
      'HolidayDeleted',
      'HolidaySkipped',
      'CalendarEventAdded',
      'CalendarEventUpdated',
      'CalendarEventRemoved',
    ]
  }
  if (path.startsWith('/admin/projects')) {
    return ['CellReviewRequested', 'CellCreatedUnassigned']
  }

  if (path === '/employee/leave' || path.startsWith('/employee/leave/')) {
    return ['LeaveApproved', 'LeaveRejected', 'LeaveCancelled', 'LeaveLop']
  }
  if (path === '/employee/documents' || path.startsWith('/employee/documents/')) {
    return ['DocumentApproved', 'DocumentRejected', 'PayslipSent', 'PayslipRegenerated']
  }
  if (path === '/employee/tickets' || path.startsWith('/employee/tickets/')) {
    return ['TicketStatusUpdated', 'TicketCommentAdded']
  }
  if (path.startsWith('/employee/calendar')) {
    return [
      'HolidayAdded',
      'HolidayUpdated',
      'HolidayDeleted',
      'HolidaySkipped',
      'CalendarEventAdded',
      'CalendarEventUpdated',
      'CalendarEventRemoved',
    ]
  }
  if (path.startsWith('/employee/projects')) {
    return ['CellReviewApproved', 'CellReviewRejected', 'CellAssigned', 'CellCreatedUnassigned']
  }

  return []
}

/** Tab badges follow server unread counts and clear when route notifications are marked read. */
export function syncTabIndicators(
  _tabIndicators: TabIndicatorCounts,
  serverCategories: TabIndicatorCounts,
  _isInitialized: boolean,
): TabIndicatorCounts {
  return {
    leaves: serverCategories.leaves,
    documents: serverCategories.documents,
  }
}

export function resolveNavNotificationCount(options: {
  notificationKey?: 'leaves' | 'documents'
  isActive: boolean
  counts: TabIndicatorCounts
  pendingLeaves?: number
}): number | undefined {
  const { notificationKey, isActive, counts, pendingLeaves = 0 } = options
  if (!notificationKey) return undefined
  if (isActive) return 0

  if (notificationKey === 'leaves') {
    return Math.max(counts.leaves ?? 0, pendingLeaves)
  }

  return counts[notificationKey] ?? 0
}

export function countUnreadByCategory(notifications: NotificationData[]) {
  let leaves = 0
  let documents = 0
  let other = 0

  for (const notification of notifications) {
    if (notification.isRead) continue
    const category = getNotificationCategory(notification.type)
    if (category === 'leaves') leaves++
    else if (category === 'documents') documents++
    else other++
  }

  return {
    leaves,
    documents,
    other,
    total: leaves + documents + other,
  }
}
