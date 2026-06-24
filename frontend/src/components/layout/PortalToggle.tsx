import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '@store/notificationStore'
import { toast } from 'sonner'
import { useAuthStore, type PortalTarget, type UserRole } from '@store/authStore'
import { cn } from '@/utils/cn'

type PortalToggleProps = {
  className?: string
}

const PORTALS: { id: UserRole; label: string }[] = [
  { id: 'admin', label: 'Admin' },
  { id: 'employee', label: 'Employee' },
]

export function PortalToggle({ className }: PortalToggleProps) {
  const portalAdmin = useAuthStore((s) => s.portalAdmin)
  const role = useAuthStore((s) => s.role)
  const switchPortal = useAuthStore((s) => s.switchPortal)
  const clearNotifications = useNotificationStore((s) => s.clearNotifications)
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount)
  const fetchNotificationsSilent = useNotificationStore((s) => s.fetchNotificationsSilent)
  const navigate = useNavigate()
  const [switching, setSwitching] = useState(false)

  if (!portalAdmin || !role) return null

  const handleSwitch = async (target: PortalTarget) => {
    if (switching || target === role) return
    setSwitching(true)
    try {
      await switchPortal(target)
      clearNotifications()
      await fetchUnreadCount()
      void fetchNotificationsSilent()
      navigate(target === 'admin' ? '/admin' : '/employee', { replace: true })
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Could not switch portal. Please try again.'
      toast.error(message)
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div
      className={cn('cmd-portal-toggle', className)}
      role="group"
      aria-label="Switch portal"
    >
      {PORTALS.map((portal) => {
        const isActive = role === portal.id
        return (
          <button
            key={portal.id}
            type="button"
            onClick={() => void handleSwitch(portal.id)}
            disabled={switching}
            aria-pressed={isActive}
            aria-label={`${portal.label}${isActive ? ' (current)' : ''}`}
            className={cn(
              'cmd-portal-toggle__segment',
              isActive && 'cmd-portal-toggle__segment--active',
            )}
          >
            {portal.label}
          </button>
        )
      })}
    </div>
  )
}
