import { useCallback, useEffect, useRef, useState } from 'react'
import {
  NOTIFICATION_POLL_MS,
  useNotificationStore,
  type NotificationData,
} from '@store/notificationStore'
import {
  hasCelebratedLeaveApproval,
  markLeaveApprovalCelebrated,
} from '@utils/celebrationAckStorage'

export type LeaveApprovalCelebrationPayload = {
  notificationId: string
  title: string
  message: string
}

const NOTIFICATION_AUTO_DISMISS_MS = 6500
const PARTICLE_DURATION_MS = 9200

function findPendingLeaveApprovals(notifications: NotificationData[]): NotificationData[] {
  return notifications.filter(
    (notification) =>
      notification.type === 'LeaveApproved' &&
      !notification.isRead &&
      !hasCelebratedLeaveApproval(notification.id),
  )
}

function toPayload(notification: NotificationData): LeaveApprovalCelebrationPayload {
  return {
    notificationId: notification.id,
    title: notification.title || '🎉 Leave Approved!',
    message: notification.message || 'Your leave request has been approved.',
  }
}

export function useLeaveApprovalCelebration() {
  const notifications = useNotificationStore((state) => state.notifications)
  const isInitialized = useNotificationStore((state) => state.isInitialized)
  const fetchNotificationsSilent = useNotificationStore((state) => state.fetchNotificationsSilent)

  const [activeCelebration, setActiveCelebration] = useState<LeaveApprovalCelebrationPayload | null>(null)
  const [particlesActive, setParticlesActive] = useState(false)

  const queueRef = useRef<NotificationData[]>([])
  const isPlayingRef = useRef(false)
  const notificationTimerRef = useRef<number | null>(null)
  const particleTimerRef = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (notificationTimerRef.current != null) {
      window.clearTimeout(notificationTimerRef.current)
      notificationTimerRef.current = null
    }
    if (particleTimerRef.current != null) {
      window.clearTimeout(particleTimerRef.current)
      particleTimerRef.current = null
    }
  }, [])

  const startCelebration = useCallback(
    (notification: NotificationData) => {
      clearTimers()
      isPlayingRef.current = true
      markLeaveApprovalCelebrated(notification.id)
      setActiveCelebration(toPayload(notification))
      setParticlesActive(true)

      notificationTimerRef.current = window.setTimeout(() => {
        setActiveCelebration(null)
      }, NOTIFICATION_AUTO_DISMISS_MS)

      particleTimerRef.current = window.setTimeout(() => {
        setParticlesActive(false)
        isPlayingRef.current = false

        const next = queueRef.current.shift()
        if (next) {
          startCelebration(next)
        }
      }, PARTICLE_DURATION_MS)
    },
    [clearTimers],
  )

  const enqueueCelebrations = useCallback(
    (candidates: NotificationData[]) => {
      for (const notification of candidates) {
        const alreadyQueued = queueRef.current.some((item) => item.id === notification.id)
        const currentlyPlaying = activeCelebration?.notificationId === notification.id
        if (alreadyQueued || currentlyPlaying) continue
        queueRef.current.push(notification)
      }

      if (isPlayingRef.current) return

      const next = queueRef.current.shift()
      if (next) {
        startCelebration(next)
      }
    },
    [activeCelebration?.notificationId, startCelebration],
  )

  const dismissCelebration = useCallback(() => {
    setActiveCelebration(null)
  }, [])

  useEffect(() => {
    void fetchNotificationsSilent()
    const interval = window.setInterval(() => {
      void fetchNotificationsSilent()
    }, NOTIFICATION_POLL_MS)
    return () => window.clearInterval(interval)
  }, [fetchNotificationsSilent])

  useEffect(() => {
    if (!isInitialized) return
    enqueueCelebrations(findPendingLeaveApprovals(notifications))
  }, [notifications, isInitialized, enqueueCelebrations])

  useEffect(() => () => clearTimers(), [clearTimers])

  return {
    activeCelebration,
    particlesActive,
    dismissCelebration,
  }
}
