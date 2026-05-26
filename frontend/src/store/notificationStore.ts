import { create } from 'zustand'
import api from '@services/api'
import { playNotificationSound } from '@utils/notificationSound'

/** Background poll interval for unread badge (ms). */
export const NOTIFICATION_POLL_MS = 60_000

let unreadCountRequest: Promise<void> | null = null

async function runUnreadCountFetch(
  set: (partial: Partial<NotificationState>) => void,
  get: () => NotificationState,
  silent: boolean,
) {
  if (unreadCountRequest) return unreadCountRequest

  unreadCountRequest = (async () => {
    try {
      const response = await api.get('/notifications/count/unread')
      const prevCount = get().lastUnreadCount
      const isInitialized = get().isInitialized
      const newCount = response.data.count

      if (isInitialized && newCount > prevCount) {
        playNotificationSound()
        void get().fetchNotificationsSilent()
      }

      set({ unreadCount: newCount, lastUnreadCount: newCount, isInitialized: true })
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

export interface NotificationData {
  id: string
  recipientId: string
  recipientType: 'Employee' | 'Manager' | 'Admin'
  type: 'LeaveSubmitted' | 'LeaveApproved' | 'LeaveRejected' | 'LeaveCancelled' | 'PayslipSent'
    | 'HolidayAdded' | 'HolidayUpdated' | 'HolidayDeleted' | 'HolidaySkipped'
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
    skippedReason?: string
  }
  isRead: boolean
  createdAt: string
}

interface NotificationState {
  notifications: NotificationData[]
  unreadCount: number
  loading: boolean
  lastNotificationCount: number
  lastUnreadCount: number
  isInitialized: boolean
  fetchNotifications: () => Promise<void>
  fetchNotificationsSilent: () => Promise<void>
  fetchUnreadCount: () => Promise<void>
  fetchUnreadCountSilent: () => Promise<void>
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (notificationId: string) => Promise<void>
  clearNotifications: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
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
      
      // Play sound only if initialized AND unread count increased
      if (isInitialized && unreadCount > prevUnreadCount) {
        playNotificationSound()
      }
      
      set({ 
        notifications: response.data, 
        loading: false, 
        lastNotificationCount: newCount, 
        lastUnreadCount: unreadCount, 
        unreadCount,
        isInitialized: true
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
      
      if (isInitialized && unreadCount > prevUnreadCount) {
        playNotificationSound()
      }
      
      set({ 
        notifications: response.data, 
        lastNotificationCount: newCount, 
        lastUnreadCount: unreadCount, 
        unreadCount,
        isInitialized: true
      })
    } catch (error) {
      console.error('[Notifications] Error fetching notifications:', error)
      // Silently fail - don't show toast for background fetch
    }
  },

  fetchUnreadCount: async () => {
    await runUnreadCountFetch(set, get, false)
  },

  fetchUnreadCountSilent: async () => {
    await runUnreadCountFetch(set, get, true)
  },

  markAsRead: async (notificationId: string) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`)
      const notifications = get().notifications.map((n) =>
        n.id === notificationId ? { ...n, isRead: true } : n
      )
      const unreadCount = notifications.filter((n) => !n.isRead).length
      set({ notifications, unreadCount })
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  },

  markAllAsRead: async () => {
    try {
      await api.patch('/notifications/read-all')
      const notifications = get().notifications.map((n) => ({ ...n, isRead: true }))
      set({ notifications, unreadCount: 0 })
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  },

  deleteNotification: async (notificationId: string) => {
    try {
      await api.delete(`/notifications/${notificationId}`)
      const deletedNotification = get().notifications.find((n) => n.id === notificationId)
      const notifications = get().notifications.filter((n) => n.id !== notificationId)
      // Update unreadCount if deleted notification was unread
      let unreadCount = get().unreadCount
      if (deletedNotification && !deletedNotification.isRead) {
        unreadCount = Math.max(0, unreadCount - 1)
      }
      set({ notifications, unreadCount })
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  },

  clearNotifications: () => {
    set({ notifications: [], unreadCount: 0 })
  },
}))
