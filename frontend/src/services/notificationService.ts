import api from './api'

export interface NotificationCounts {
  leaves: number
  documents: number
  other: number
  total: number
}

export async function getUnreadCountsByCategory(): Promise<NotificationCounts> {
  const { data } = await api.get<NotificationCounts>('/notifications/counts-by-category')
  return data
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>('/notifications/count/unread')
  return data.count
}
