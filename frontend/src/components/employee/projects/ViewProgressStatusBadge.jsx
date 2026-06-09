import { VIEW_PROGRESS_LABELS } from '@/utils/cellWorkflowUi'
import { cn } from '@pages/employee/lib/utils'

const STATUS_CLASS = {
  not_started: 'emp-wf-view-status--not-started',
  in_progress: 'emp-wf-view-status--in-progress',
  completed: 'emp-wf-view-status--completed',
}

export function ViewProgressStatusBadge({ status, className }) {
  const safeStatus = status && STATUS_CLASS[status] ? status : 'not_started'
  const label = VIEW_PROGRESS_LABELS[safeStatus] || safeStatus

  return (
    <span
      className={cn(
        'emp-wf-view-status',
        'emp-wf-view-status--inline',
        STATUS_CLASS[safeStatus],
        className,
      )}
    >
      {label}
    </span>
  )
}
