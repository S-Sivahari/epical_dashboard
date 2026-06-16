import { useEffect } from 'react'
import { useNotificationStore, NOTIFICATION_POLL_MS } from '@store/notificationStore'
import type { NotificationCounts } from '@services/notificationService'

export function useNotificationCounts(refreshInterval = NOTIFICATION_POLL_MS) {
  const tabIndicatorCounts = useNotificationStore((state) => state.tabIndicatorCounts)
  const isInitialized = useNotificationStore((state) => state.isInitialized)
  const fetchCategoryCounts = useNotificationStore((state) => state.fetchCategoryCounts)

  useEffect(() => {
    void fetchCategoryCounts()

    const interval = setInterval(() => {
      void fetchCategoryCounts()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [fetchCategoryCounts, refreshInterval])

  const counts: NotificationCounts = {
    leaves: tabIndicatorCounts.leaves,
    documents: tabIndicatorCounts.documents,
    other: 0,
    total: tabIndicatorCounts.leaves + tabIndicatorCounts.documents,
  }

  return {
    counts,
    loading: !isInitialized,
    refresh: fetchCategoryCounts,
  }
}
