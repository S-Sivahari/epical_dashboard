import { useEffect } from 'react'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import './celebration.css'

type LeaveApprovalNotificationProps = {
  open: boolean
  title?: string
  message?: string
  autoDismissMs?: number
  onDismiss: () => void
}

export function LeaveApprovalNotification({
  open,
  title = '🎉 Leave Approved!',
  message = 'Your leave request has been approved.',
  autoDismissMs = 6500,
  onDismiss,
}: LeaveApprovalNotificationProps) {
  useEffect(() => {
    if (!open) return undefined
    const timer = window.setTimeout(onDismiss, autoDismissMs)
    return () => window.clearTimeout(timer)
  }, [open, autoDismissMs, onDismiss])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="leave-approval-notification"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="leave-approval-notification__accent" />
          <div className="leave-approval-notification__body">
            <div className="leave-approval-notification__icon" aria-hidden>
              🎉
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="leave-approval-notification__title">{title}</h3>
              <p className="leave-approval-notification__message">{message}</p>
            </div>
            <button
              type="button"
              className="leave-approval-notification__close"
              onClick={onDismiss}
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
