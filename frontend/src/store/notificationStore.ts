import { create } from 'zustand'
import api from '@services/api'
import { playNotificationSound } from '@utils/notificationSound'
import { toast } from 'sonner'

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
      
      console.log(`[Notifications] Initial fetch: unreadCount=${unreadCount}, isInitialized=${isInitialized}`)
      
      // Play sound only if initialized AND unread count increased
      if (isInitialized && unreadCount > prevUnreadCount) {
        console.log(`[Notifications] New notification received, playing sound`)
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
      toast.error('Failed to fetch notifications')
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
      
      console.log(`[Notifications] Silent fetch: prevUnread=${prevUnreadCount}, newUnread=${unreadCount}, isInitialized=${isInitialized}`)
      
      // Play sound only if initialized AND unread count increased
      if (isInitialized && unreadCount > prevUnreadCount) {
        console.log(`[Notifications] New notification detected, playing sound`)
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
      toast.error('Failed to fetch notifications (silent)')
    }
  },

  fetchUnreadCount: async () => {
    try {
      const response = await api.get('/notifications/count/unread')
      const prevCount = get().lastUnreadCount
      const isInitialized = get().isInitialized
      const newCount = response.data.count
      
      // Play sound only if initialized AND unread count increased
      if (isInitialized && newCount > prevCount) {
        console.log(`[Notifications] Unread count increased from ${prevCount} to ${newCount}, playing sound`)
        playNotificationSound()
      }
      
      set({ unreadCount: newCount, lastUnreadCount: newCount, isInitialized: true })
    } catch (error) {
      console.error('[Notifications] Error fetching unread count:', error)
      toast.error('Failed to fetch unread count')
    }
  },

  fetchUnreadCountSilent: async () => {
    try {
      const response = await api.get('/notifications/count/unread')
      const prevCount = get().lastUnreadCount
      const isInitialized = get().isInitialized
      const newCount = response.data.count
      
      console.log(`[Notifications] Unread count: prev=${prevCount}, new=${newCount}, isInitialized=${isInitialized}`)
      
      // Play sound only if initialized AND unread count increased
      if (isInitialized && newCount > prevCount) {
        console.log(`[Notifications] Unread count increased, playing sound`)
        playNotificationSound()
      }
      
      set({ unreadCount: newCount, lastUnreadCount: newCount, isInitialized: true })
    } catch (error) {
      console.error('[Notifications] Error fetching unread count:', error)
      toast.error('Failed to fetch unread count (silent)')
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
