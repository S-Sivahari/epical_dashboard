import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useNotificationStore } from '@store/notificationStore'

/** Marks route-related notifications as read for the bell when the user opens the matching page. */
export function useNotificationRouteSync() {
  const { pathname } = useLocation()
  const markAsReadForPath = useNotificationStore((state) => state.markAsReadForPath)

  useEffect(() => {
    void markAsReadForPath(pathname)
  }, [pathname, markAsReadForPath])
}
