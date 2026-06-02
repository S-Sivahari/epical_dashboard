import { useCallback, useState } from 'react'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/utils/cn'
import {
  DASHBOARD_PENDING_APPROVALS,
  DASHBOARD_SYSTEM_ACTIVITY,
  type PendingApprovalTask,
} from './dashboardRightWorkspaceData'

type DashboardRightWorkspaceProps = {
  className?: string
}

export function DashboardRightWorkspace({ className }: DashboardRightWorkspaceProps) {
  const [pendingQueue, setPendingQueue] = useState<PendingApprovalTask[]>(
    () => DASHBOARD_PENDING_APPROVALS,
  )

  const handleApprove = useCallback((task: PendingApprovalTask) => {
    setPendingQueue((prev) => prev.filter((item) => item.id !== task.id))
    toast.success(`Approved: ${task.title}`)
  }, [])

  const handleReject = useCallback((task: PendingApprovalTask) => {
    setPendingQueue((prev) => prev.filter((item) => item.id !== task.id))
    toast.error(`Rejected: ${task.title}`)
  }, [])

  return (
    <div className={cn('dashboard-right-workspace', className)}>
      <section
        className="dashboard-workspace-panel dashboard-approvals-panel"
        aria-label="Pending approvals queue"
      >
        <header className="dashboard-workspace-header">
          <h2 className="dashboard-workspace-header-title !text-white">PENDING APPROVALS QUEUE</h2>
          <span
            className="dashboard-workspace-count !text-white"
            aria-label={`${pendingQueue.length} pending`}
          >
            ({pendingQueue.length})
          </span>
        </header>

        <div className="dashboard-workspace-body">
          {pendingQueue.length === 0 ? (
            <p className="dashboard-workspace-empty">No pending approvals in queue.</p>
          ) : (
            <ul className="dashboard-approvals-list" role="list">
              {pendingQueue.map((task, index) => {
                const isLast = index === pendingQueue.length - 1
                return (
                  <li
                    key={task.id}
                    className={cn(
                      'dashboard-approval-card',
                      !isLast && 'dashboard-approval-card--bordered',
                    )}
                  >
                    <p className="dashboard-approval-title">{task.title}</p>
                    <div className="dashboard-approval-actions-row">
                      <span className="dashboard-approval-age">{task.requestedAgo}</span>
                      <div className="dashboard-approval-buttons">
                        <button
                          type="button"
                          className="dashboard-approval-btn dashboard-approval-btn--approve"
                          aria-label={`Approve ${task.title}`}
                          onClick={() => handleApprove(task)}
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          className="dashboard-approval-btn dashboard-approval-btn--reject"
                          aria-label={`Reject ${task.title}`}
                          onClick={() => handleReject(task)}
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      <section
        className="dashboard-workspace-panel dashboard-activity-panel"
        aria-label="System activity log"
      >
        <header className="dashboard-workspace-header">
          <h2 className="dashboard-workspace-header-title !text-white">SYSTEM ACTIVITY LOG</h2>
        </header>

        <div className="dashboard-workspace-body">
          <ul className="dashboard-activity-timeline" role="list">
            {DASHBOARD_SYSTEM_ACTIVITY.map((entry, index) => {
              const isLast = index === DASHBOARD_SYSTEM_ACTIVITY.length - 1
              return (
                <li
                  key={entry.id}
                  className={cn('dashboard-activity-item', isLast && 'dashboard-activity-item--last')}
                >
                  <span className="dashboard-activity-dot" aria-hidden />
                  <div className="dashboard-activity-content">
                    <p className="dashboard-activity-message">{entry.message}</p>
                    <time className="dashboard-activity-time">{entry.time}</time>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    </div>
  )
}
