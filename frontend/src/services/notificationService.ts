import api from './api'

export interface NotificationCounts {
  leaves: number
  documents: number
  payslips: number
  tickets: number
  calendar: number
  projects: number
  other: number
  total: number
}

export interface NotificationHistoryItem {
  id: string
  title: string
  message: string
  type: string
  isRead: boolean
  createdAt: string
  relatedData?: Record<string, unknown>
  relatedId?: string
}

export interface NotificationHistoryResponse {
  notifications: NotificationHistoryItem[]
  retentionDays: number
  purgedCount: number
}

export async function getUnreadCountsByCategory(): Promise<NotificationCounts> {
  const { data } = await api.get<NotificationCounts>('/notifications/counts-by-category')
  return data
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>('/notifications/count/unread')
  return data.count
}

export async function getNotificationHistory(): Promise<NotificationHistoryResponse> {
  const { data } = await api.get<NotificationHistoryResponse>('/notifications/history')
  return data
}

export async function markNotificationsAsReadByTypes(
  types: string[],
): Promise<number> {
  const { data } = await api.patch<{ modifiedCount: number }>('/notifications/read-by-types', {
    types,
  })
  return data.modifiedCount
}
