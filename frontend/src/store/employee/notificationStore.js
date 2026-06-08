import { create } from 'zustand'
import { notifications as initial } from '@pages/employee/data/mockData'

export const useNotificationStore = create((set, get) => ({
  notifications: initial,
  unreadCount: initial.filter((n) => !n.read).length,
  markAsRead: (id) =>
    set((s) => {
      const notifications = s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      )
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
      }
    }),
  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
}))
