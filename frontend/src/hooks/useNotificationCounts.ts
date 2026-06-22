import { useEffect } from 'react'
import { useNotificationStore, NOTIFICATION_POLL_MS } from '@store/notificationStore'
import type { NotificationCounts } from '@services/notificationService'
import type { TabIndicatorCounts } from '@utils/notificationCategories'

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

  const counts: NotificationCounts & TabIndicatorCounts = {
    ...tabIndicatorCounts,
    other: 0,
    total:
      tabIndicatorCounts.leaves +
      tabIndicatorCounts.documents +
      tabIndicatorCounts.payslips +
      tabIndicatorCounts.tickets +
      tabIndicatorCounts.calendar +
      tabIndicatorCounts.projects,
  }

  return {
    counts,
    loading: !isInitialized,
    refresh: fetchCategoryCounts,
  }
}
