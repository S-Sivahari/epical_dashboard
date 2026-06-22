import { useCallback, useEffect, useRef, useState } from 'react'
import type { CelebrationVariant } from '@components/employee/celebration/CelebrationParticles'
import {
  NOTIFICATION_POLL_MS,
  useNotificationStore,
  type NotificationData,
} from '@store/notificationStore'
import {
  hasAcknowledgedLeaveReaction,
  markLeaveReactionAcknowledged,
} from '@utils/celebrationAckStorage'

export type LeaveStatusCelebrationPayload = {
  notificationId: string
  variant: CelebrationVariant
  title: string
  message: string
}

const REACTION_NOTIFICATION_TYPES = ['LeaveApproved', 'LeaveRejected'] as const
type ReactionNotificationType = (typeof REACTION_NOTIFICATION_TYPES)[number]

const NOTIFICATION_AUTO_DISMISS_MS = 6500
const PARTICLE_DURATION_MS = 6200
/** Ignore very old leave reactions so historic notifications do not celebrate on first deploy. */
const MAX_REACTION_AGE_MS = 30 * 24 * 60 * 60 * 1000

function isReactionType(type: NotificationData['type']): type is ReactionNotificationType {
  return REACTION_NOTIFICATION_TYPES.includes(type as ReactionNotificationType)
}

function toVariant(type: ReactionNotificationType): CelebrationVariant {
  return type === 'LeaveRejected' ? 'rejected' : 'approved'
}

function isRecentReaction(notification: NotificationData): boolean {
  const createdAt = new Date(notification.createdAt).getTime()
  if (Number.isNaN(createdAt)) return true
  return Date.now() - createdAt <= MAX_REACTION_AGE_MS
}

function findPendingLeaveReactions(notifications: NotificationData[]): NotificationData[] {
  return notifications
    .filter(
      (notification) =>
        isReactionType(notification.type) &&
        isRecentReaction(notification) &&
        !hasAcknowledgedLeaveReaction(notification.id),
    )
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
}

function toPayload(notification: NotificationData): LeaveStatusCelebrationPayload {
  const variant = toVariant(notification.type as ReactionNotificationType)
  if (variant === 'rejected') {
    return {
      notificationId: notification.id,
      variant,
      title: notification.title || '😭 Leave Rejected',
      message: notification.message || 'Your leave request was not approved.',
    }
  }
  return {
    notificationId: notification.id,
    variant,
    title: notification.title || '🎉 Leave Approved!',
    message: notification.message || 'Your leave request has been approved.',
  }
}

export function useLeaveApprovalCelebration() {
  const notifications = useNotificationStore((state) => state.notifications)
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications)
  const fetchNotificationsSilent = useNotificationStore((state) => state.fetchNotificationsSilent)
  const markAsRead = useNotificationStore((state) => state.markAsRead)

  const [activeCelebration, setActiveCelebration] = useState<LeaveStatusCelebrationPayload | null>(null)
  const [particlesActive, setParticlesActive] = useState(false)
  const [particleVariant, setParticleVariant] = useState<CelebrationVariant>('approved')

  const queueRef = useRef<NotificationData[]>([])
  const isPlayingRef = useRef(false)
  const notificationTimerRef = useRef<number | null>(null)
  const particleTimerRef = useRef<number | null>(null)
  const hasBootstrappedRef = useRef(false)

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
      const payload = toPayload(notification)
      clearTimers()
      isPlayingRef.current = true
      markLeaveReactionAcknowledged(notification.id)
      void markAsRead(notification.id)
      setParticleVariant(payload.variant)
      setActiveCelebration(payload)
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
    [clearTimers, markAsRead],
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

  const syncPendingReactions = useCallback(() => {
    enqueueCelebrations(findPendingLeaveReactions(notifications))
  }, [notifications, enqueueCelebrations])

  useEffect(() => {
    if (hasBootstrappedRef.current) return
    hasBootstrappedRef.current = true

    void fetchNotifications().finally(() => {
      syncPendingReactions()
    })
  }, [fetchNotifications, syncPendingReactions])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchNotificationsSilent()
    }, NOTIFICATION_POLL_MS)
    return () => window.clearInterval(interval)
  }, [fetchNotificationsSilent])

  useEffect(() => {
    syncPendingReactions()
  }, [syncPendingReactions])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void fetchNotificationsSilent().finally(() => {
        syncPendingReactions()
      })
    }

    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchNotificationsSilent, syncPendingReactions])

  useEffect(() => () => clearTimers(), [clearTimers])

  return {
    activeCelebration,
    particlesActive,
    particleVariant,
    dismissCelebration,
  }
}
