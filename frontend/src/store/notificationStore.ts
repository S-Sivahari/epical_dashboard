import { create } from 'zustand'
import api from '@services/api'

export interface NotificationData {
  id: string
  recipientId: string
  recipientType: 'Employee' | 'Manager' | 'Admin'
  type: 'LeaveSubmitted' | 'LeaveApproved' | 'LeaveRejected' | 'LeaveCancelled'
  title: string
  message: string
  relatedData: {
    leaveId?: string
    employeeId?: string
    employeeName?: string
  }
  isRead: boolean
  createdAt: string
}

interface NotificationState {
  notifications: NotificationData[]
  unreadCount: number
  loading: boolean
  fetchNotifications: () => Promise<void>
  fetchUnreadCount: () => Promise<void>
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (notificationId: string) => Promise<void>
  clearNotifications: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async () => {
    try {
      set({ loading: true })
      const response = await api.get('/notifications')
      set({ notifications: response.data, loading: false })
    } catch (error) {
      console.error('Error fetching notifications:', error)
      set({ loading: false })
    }
  },

  fetchUnreadCount: async () => {
    try {
      const response = await api.get('/notifications/count/unread')
      set({ unreadCount: response.data.count })
    } catch (error) {
      console.error('Error fetching unread count:', error)
    }
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
