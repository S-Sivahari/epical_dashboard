import type { NotificationData } from '@store/notificationStore'
import type { NotificationCounts } from '@services/notificationService'

/** Tab keys that map to nav items with notification badges. */
export type NotificationTabKey =
  | 'leaves'
  | 'documents'
  | 'payslips'
  | 'tickets'
  | 'calendar'
  | 'projects'

export type TabIndicatorCounts = Pick<
  NotificationCounts,
  'leaves' | 'documents' | 'payslips' | 'tickets' | 'calendar' | 'projects'
>

export const EMPTY_TAB_INDICATORS: TabIndicatorCounts = {
  leaves: 0,
  documents: 0,
  payslips: 0,
  tickets: 0,
  calendar: 0,
  projects: 0,
}

export function getNotificationTabKey(type: NotificationData['type']): NotificationTabKey | null {
  if (type.startsWith('Leave')) return 'leaves'
  if (type.startsWith('Document')) return 'documents'
  if (type.startsWith('Payslip')) return 'payslips'
  if (type.startsWith('Ticket')) return 'tickets'
  if (type.startsWith('Holiday') || type.startsWith('CalendarEvent')) return 'calendar'
  if (type.startsWith('Cell')) return 'projects'
  return null
}

/** Notification types that should be marked read when the user visits a route. */
export function getNotificationTypesForPath(pathname: string): NotificationData['type'][] {
  const path = pathname.replace(/\/+$/, '') || '/'

  if (path === '/admin/leaves' || path.startsWith('/admin/leaves/')) {
    return ['LeaveSubmitted', 'LeaveCancelled']
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
  if (
    path.startsWith('/admin/projects') ||
    path.startsWith('/admin/project-management') ||
    path.startsWith('/admin/project-analysis')
  ) {
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
  if (
    path.startsWith('/employee/project-analysis') ||
    path.startsWith('/employee/projects')
  ) {
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
  return { ...serverCategories }
}

export function resolveNavNotificationCount(options: {
  notificationKey?: NotificationTabKey
  /** Sum multiple tab buckets on one nav item (e.g. employee Documents includes payslips). */
  notificationBadgeKeys?: NotificationTabKey[]
  isActive: boolean
  counts: TabIndicatorCounts
}): number | undefined {
  const { notificationKey, notificationBadgeKeys, isActive, counts } = options
  const keys = notificationBadgeKeys ?? (notificationKey ? [notificationKey] : [])
  if (!keys.length) return undefined
  if (isActive) return 0

  return keys.reduce((sum, key) => sum + (counts[key] ?? 0), 0)
}

export function countUnreadByCategory(notifications: NotificationData[]): NotificationCounts {
  const buckets: TabIndicatorCounts = { ...EMPTY_TAB_INDICATORS }
  let other = 0

  for (const notification of notifications) {
    if (notification.isRead) continue
    const tabKey = getNotificationTabKey(notification.type)
    if (tabKey) {
      buckets[tabKey] += 1
    } else {
      other += 1
    }
  }

  const tabTotal =
    buckets.leaves +
    buckets.documents +
    buckets.payslips +
    buckets.tickets +
    buckets.calendar +
    buckets.projects

  return {
    ...buckets,
    other,
    total: tabTotal + other,
  }
}

export function toTabIndicatorCounts(categoryCounts: NotificationCounts): TabIndicatorCounts {
  return {
    leaves: categoryCounts.leaves,
    documents: categoryCounts.documents,
    payslips: categoryCounts.payslips,
    tickets: categoryCounts.tickets,
    calendar: categoryCounts.calendar,
    projects: categoryCounts.projects,
  }
}
