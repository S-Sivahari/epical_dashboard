import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'
import { History } from 'lucide-react'
import { Modal } from '@components/ui/Modal'
import {
  getNotificationHistory,
  type NotificationHistoryItem,
} from '@services/notificationService'
import { useNotificationStore, type NotificationData } from '@store/notificationStore'
import { getNotificationRoute } from '@utils/notificationNavigation'
import { cn } from '@/utils/cn'

type NotificationHistoryDialogProps = {
  open: boolean
  onClose: () => void
}

function parseCreatedAt(value: string) {
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : new Date(value)
}

export function NotificationHistoryDialog({ open, onClose }: NotificationHistoryDialogProps) {
  const navigate = useNavigate()
  const markAsRead = useNotificationStore((s) => s.markAsRead)
  const [items, setItems] = useState<NotificationHistoryItem[]>([])
  const [retentionDays, setRetentionDays] = useState(30)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getNotificationHistory()
      setItems(data.notifications ?? [])
      setRetentionDays(data.retentionDays ?? 30)
    } catch {
      setError('Failed to load notification history')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void loadHistory()
  }, [open, loadHistory])

  const handleItemClick = async (item: NotificationHistoryItem) => {
    if (!item.isRead) {
      await markAsRead(item.id)
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
      )
    }
    const route = getNotificationRoute({
      ...item,
      type: item.type as NotificationData['type'],
      recipientType: (item as { recipientType?: NotificationData['recipientType'] }).recipientType ?? 'Employee',
      recipientId: (item as { recipientId?: string }).recipientId ?? '',
    } as NotificationData)
    onClose()
    if (route) navigate(route)
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Notification History"
      size="lg"
      modal
      className="notification-history-modal"
      headerActions={
        <span className="notification-history-badge">
          <History className="h-3.5 w-3.5" aria-hidden />
          Last {retentionDays} days
        </span>
      }
    >
      <p className="notification-history-lead">
        All notifications from the last {retentionDays} days. Older notifications are cleared automatically.
      </p>

      <div className="notification-history-scroll">
        {loading ? (
          <div className="notification-history-empty">Loading history…</div>
        ) : error ? (
          <div className="notification-history-empty notification-history-empty--error">{error}</div>
        ) : items.length === 0 ? (
          <div className="notification-history-empty">
            No notifications in the last {retentionDays} days
          </div>
        ) : (
          <ul className="notification-history-list">
            {items.map((item) => {
              const createdAt = parseCreatedAt(item.createdAt)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void handleItemClick(item)}
                    className={cn(
                      'notification-history-card',
                      !item.isRead && 'notification-history-card--unread',
                    )}
                  >
                    <div className="notification-history-card__top">
                      <h4 className="notification-history-card__title">{item.title}</h4>
                      <time
                        dateTime={createdAt.toISOString()}
                        className="notification-history-card__relative"
                        title={format(createdAt, 'PPpp')}
                      >
                        {formatDistanceToNow(createdAt, { addSuffix: true })}
                      </time>
                    </div>
                    <p className="notification-history-card__message">{item.message}</p>
                    <p className="notification-history-card__absolute">
                      {format(createdAt, 'MMM d, yyyy · h:mm a')}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}
