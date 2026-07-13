import { create } from 'zustand'
import api from '@services/api'
import {
  getUnreadCountsByCategory,
  markNotificationsAsReadByTypes,
  type NotificationCounts,
} from '@services/notificationService'
import { playNotificationSound } from '@utils/notificationSound'
import {
  countUnreadByCategory,
  EMPTY_TAB_INDICATORS,
  getNotificationTypesForPath,
  syncTabIndicators,
  toTabIndicatorCounts,
  type TabIndicatorCounts,
} from '@utils/notificationCategories'

/** Background poll interval for unread badge (ms). Changed from 60s to 5s for instant notifications */
export const NOTIFICATION_POLL_MS = 5_000

const EMPTY_CATEGORY_COUNTS: NotificationCounts = {
  leaves: 0,
  documents: 0,
  payslips: 0,
  tickets: 0,
  calendar: 0,
  projects: 0,
  other: 0,
  total: 0,
}

let unreadCountRequest: Promise<void> | null = null

async function runUnreadCountFetch(
  set: (partial: Partial<NotificationState>) => void,
  get: () => NotificationState,
  silent: boolean,
) {
  if (unreadCountRequest) return unreadCountRequest

  unreadCountRequest = (async () => {
    try {
      const [countResponse, categoryCounts] = await Promise.all([
        api.get('/notifications/count/unread'),
        getUnreadCountsByCategory(),
      ])
      const prevCount = get().lastUnreadCount
      const isInitialized = get().isInitialized
      const newCount = countResponse.data.count
      const tabIndicatorCounts = syncTabIndicators(
        get().tabIndicatorCounts,
        toTabIndicatorCounts(categoryCounts),
        isInitialized,
      )

      if (isInitialized && newCount > prevCount) {
        void playNotificationSound()
        void get().fetchNotificationsSilent()
      }

      set({
        unreadCount: newCount,
        categoryCounts,
        tabIndicatorCounts,
        lastUnreadCount: newCount,
        isInitialized: true,
      })
    } catch (error) {
      if (!silent) {
        console.error('[Notifications] Error fetching unread count:', error)
      }
    } finally {
      unreadCountRequest = null
    }
  })()

  return unreadCountRequest
}

function applyReadState(
  notifications: NotificationData[],
  predicate: (notification: NotificationData) => boolean,
) {
  return notifications.map((notification) =>
    predicate(notification) && !notification.isRead
      ? { ...notification, isRead: true }
      : notification,
  )
}

export interface NotificationData {
  id: string
  recipientId: string
  recipientType: 'Employee' | 'Manager' | 'Admin'
  type: 'LeaveSubmitted' | 'LeaveApproved' | 'LeaveRejected' | 'LeaveCancelled' | 'LeaveLop'
    | 'DocumentRequested' | 'DocumentApproved' | 'DocumentRejected'
    | 'PayslipSent' | 'PayslipRegenerated'
    | 'HolidayAdded' | 'HolidayUpdated' | 'HolidayDeleted' | 'HolidaySkipped'
    | 'CalendarEventAdded' | 'CalendarEventUpdated' | 'CalendarEventRemoved'
    | 'TicketSubmitted' | 'TicketStatusUpdated' | 'TicketCommentAdded'
    | 'CellReviewRequested' | 'CellReviewApproved' | 'CellReviewRejected'
    | 'CellCreatedUnassigned' | 'CellAssigned' | 'LibraryCreated'
    | 'NotesDelegationAssigned' | 'NotesDelegationMorning'
  title: string
  message: string
  relatedData: {
    leaveId?: string
    employeeId?: string
    employeeName?: string
    employeeEmail?: string
    payslipId?: string
    batchId?: string
    payMonth?: string
    fileName?: string
    holidayId?: string
    holidayTitle?: string
    holidayDate?: string
    calendarEventId?: string
    calendarEventTitle?: string
    calendarEventDate?: string
    skippedReason?: string
    ticketId?: string
    ticketTitle?: string
    ticketStatus?: string
    projectId?: string
    cellId?: string
    reviewId?: string
    projectName?: string
    cellName?: string
    reviewPoint?: string
    stageAtRequest?: string
    reviewOutcome?: string
    returnToStage?: string
    resolvedByName?: string
    notesDelegationId?: string
    notesDate?: string
    notesNotificationKind?: 'assigned' | 'morning'
  }
  isRead: boolean
  createdAt: string
}

interface NotificationState {
  notifications: NotificationData[]
  unreadCount: number
  categoryCounts: NotificationCounts
  tabIndicatorCounts: TabIndicatorCounts
  loading: boolean
  lastNotificationCount: number
  lastUnreadCount: number
  isInitialized: boolean
  fetchNotifications: () => Promise<void>
  fetchNotificationsSilent: () => Promise<void>
  fetchUnreadCount: () => Promise<void>
  fetchUnreadCountSilent: () => Promise<void>
  fetchCategoryCounts: () => Promise<void>
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  markAsReadForPath: (pathname: string) => Promise<void>
  deleteNotification: (notificationId: string) => Promise<void>
  deleteAllNotifications: () => Promise<void>
  clearNotifications: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  categoryCounts: EMPTY_CATEGORY_COUNTS,
  tabIndicatorCounts: EMPTY_TAB_INDICATORS,
  loading: false,
  lastNotificationCount: 0,
  lastUnreadCount: 0,
  isInitialized: false,

  fetchNotifications: async () => {
    try {
      set({ loading: true })
      const response = await api.get('/notifications')
      const prevUnreadCount = get().lastUnreadCount
      const isInitialized = get().isInitialized
      const unreadCount = response.data.filter((n: NotificationData) => !n.isRead).length
      const newCount = response.data.length
      const categoryCounts = countUnreadByCategory(response.data)

      if (isInitialized && unreadCount > prevUnreadCount) {
        void playNotificationSound()
      }

      set({
        notifications: response.data,
        loading: false,
        lastNotificationCount: newCount,
        lastUnreadCount: unreadCount,
        unreadCount,
        categoryCounts,
        isInitialized: true,
      })
    } catch (error) {
      console.error('[Notifications] Error fetching notifications:', error)
      set({ loading: false })
    }
  },

  fetchNotificationsSilent: async () => {
    try {
      const response = await api.get('/notifications')
      const prevUnreadCount = get().lastUnreadCount
      const isInitialized = get().isInitialized
      const newCount = response.data.length
      const unreadCount = response.data.filter((n: NotificationData) => !n.isRead).length
      const categoryCounts = countUnreadByCategory(response.data)

      if (isInitialized && unreadCount > prevUnreadCount) {
        void playNotificationSound()
      }

      set({
        notifications: response.data,
        lastNotificationCount: newCount,
        lastUnreadCount: unreadCount,
        unreadCount,
        categoryCounts,
        isInitialized: true,
      })
    } catch (error) {
      console.error('[Notifications] Error fetching notifications:', error)
    }
  },

  fetchUnreadCount: async () => {
    await runUnreadCountFetch(set, get, false)
  },

  fetchUnreadCountSilent: async () => {
    await runUnreadCountFetch(set, get, true)
  },

  fetchCategoryCounts: async () => {
    await runUnreadCountFetch(set, get, true)
  },

  markAsRead: async (notificationId: string) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`)
      const notifications = applyReadState(get().notifications, (n) => n.id === notificationId)
      const unreadCount = notifications.filter((n) => !n.isRead).length
      const categoryCounts = countUnreadByCategory(notifications)
      set({
        notifications,
        unreadCount,
        categoryCounts,
        tabIndicatorCounts: toTabIndicatorCounts(categoryCounts),
        lastUnreadCount: unreadCount,
      })
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  },

  markAllAsRead: async () => {
    try {
      await api.patch('/notifications/read-all')
      const notifications = get().notifications.map((n) => ({ ...n, isRead: true }))
      set({
        notifications,
        unreadCount: 0,
        categoryCounts: EMPTY_CATEGORY_COUNTS,
        tabIndicatorCounts: EMPTY_TAB_INDICATORS,
        lastUnreadCount: 0,
      })
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  },

  markAsReadForPath: async (pathname: string) => {
    const types = getNotificationTypesForPath(pathname)
    if (!types.length) return

    try {
      await markNotificationsAsReadByTypes(types)

      const notifications =
        get().notifications.length > 0
          ? applyReadState(get().notifications, (n) => types.includes(n.type))
          : get().notifications

      if (notifications.length > 0) {
        const categoryCounts = countUnreadByCategory(notifications)
        set({
          notifications,
          unreadCount: categoryCounts.total,
          lastUnreadCount: categoryCounts.total,
          categoryCounts,
          tabIndicatorCounts: toTabIndicatorCounts(categoryCounts),
        })
      }

      await get().fetchUnreadCountSilent()
    } catch (error) {
      console.error('Error marking route notifications as read:', error)
    }
  },

  deleteNotification: async (notificationId: string) => {
    try {
      await api.delete(`/notifications/${notificationId}`)
      const deletedNotification = get().notifications.find((n) => n.id === notificationId)
      const notifications = get().notifications.filter((n) => n.id !== notificationId)
      let unreadCount = get().unreadCount
      if (deletedNotification && !deletedNotification.isRead) {
        unreadCount = Math.max(0, unreadCount - 1)
      }
      const categoryCounts = countUnreadByCategory(notifications)
      set({
        notifications,
        unreadCount,
        categoryCounts,
        tabIndicatorCounts: toTabIndicatorCounts(categoryCounts),
        lastUnreadCount: unreadCount,
      })
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  },

  deleteAllNotifications: async () => {
    try {
      await api.delete('/notifications/all')
      set({
        notifications: [],
        unreadCount: 0,
        categoryCounts: EMPTY_CATEGORY_COUNTS,
        tabIndicatorCounts: EMPTY_TAB_INDICATORS,
        lastUnreadCount: 0,
        lastNotificationCount: 0,
      })
    } catch (error) {
      console.error('Error deleting all notifications:', error)
    }
  },

  clearNotifications: () => {
    set({
      notifications: [],
      unreadCount: 0,
      categoryCounts: EMPTY_CATEGORY_COUNTS,
      tabIndicatorCounts: EMPTY_TAB_INDICATORS,
    })
  },
}))
