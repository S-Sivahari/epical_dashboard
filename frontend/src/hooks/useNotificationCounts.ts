import { useEffect, useState } from 'react'
import { getUnreadCountsByCategory, type NotificationCounts } from '@services/notificationService'

export function useNotificationCounts(refreshInterval = 30000) {
  const [counts, setCounts] = useState<NotificationCounts>({
    leaves: 0,
    documents: 0,
    other: 0,
    total: 0,
  })
  const [loading, setLoading] = useState(true)

  const fetchCounts = async () => {
    try {
      const data = await getUnreadCountsByCategory()
      setCounts(data)
    } catch (error) {
      console.error('Failed to fetch notification counts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCounts()

    // Poll for updates
    const interval = setInterval(fetchCounts, refreshInterval)

    return () => clearInterval(interval)
  }, [refreshInterval])

  return { counts, loading, refresh: fetchCounts }
}
