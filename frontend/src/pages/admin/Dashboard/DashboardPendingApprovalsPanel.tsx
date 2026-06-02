import { useCallback, useEffect, useRef, useState } from 'react'
import { useLeaves } from '@hooks/useLeaves'
import {
  approveDocumentRequest,
  rejectDocumentRequest,
} from '@services/documentRequestService'
import { cn } from '@/utils/cn'
import type { PendingApprovalTask } from './dashboardRightWorkspaceData'

type DashboardPendingApprovalsPanelProps = {
  tasks: PendingApprovalTask[]
  className?: string
}

export function DashboardPendingApprovalsPanel({
  tasks,
  className,
}: DashboardPendingApprovalsPanelProps) {
  const { approveLeave, rejectLeave } = useLeaves()
  const [queue, setQueue] = useState<PendingApprovalTask[]>(tasks)
  const processingRef = useRef(new Set<string>())
  const [processingIds, setProcessingIds] = useState<string[]>([])

  useEffect(() => {
    setQueue((prev) => {
      const inFlight = processingRef.current
      const next = tasks.filter((t) => !inFlight.has(t.id))
      if (inFlight.size === 0) return next
      const nextIds = new Set(next.map((t) => t.id))
      return prev.filter((t) => inFlight.has(t.id) || nextIds.has(t.id))
    })
  }, [tasks])

  const runAction = useCallback(
    async (task: PendingApprovalTask, action: 'approve' | 'reject') => {
      if (processingRef.current.has(task.id)) return

      processingRef.current.add(task.id)
      setProcessingIds((prev) => (prev.includes(task.id) ? prev : [...prev, task.id]))
      setQueue((prev) => prev.filter((item) => item.id !== task.id))

      try {
        if (action === 'approve') {
          if (task.kind === 'leave') {
            await approveLeave(task.sourceId)
          } else {
            await approveDocumentRequest(task.sourceId)
          }
        } else {
          if (task.kind === 'leave') {
            await rejectLeave(task.sourceId, 'Rejected from dashboard')
          } else {
            await rejectDocumentRequest(task.sourceId, 'Rejected from dashboard')
          }
        }
      } catch {
        processingRef.current.delete(task.id)
        setProcessingIds((prev) => prev.filter((id) => id !== task.id))
        setQueue((prev) => (prev.some((i) => i.id === task.id) ? prev : [...prev, task]))
      } finally {
        processingRef.current.delete(task.id)
        setProcessingIds((prev) => prev.filter((id) => id !== task.id))
      }
    },
    [approveLeave, rejectLeave],
  )

  return (
    <section
      className={cn(
        'dashboard-workspace-panel dashboard-workspace-panel--mint dashboard-approvals-panel',
        className,
      )}
      aria-label="Pending approvals queue"
    >
      <header className="dashboard-insight-panel-header">
        <h3 className="dashboard-insight-panel-title">Pending approvals queue</h3>
        <span className="dashboard-insight-panel-count" aria-label={`${queue.length} pending`}>
          ({queue.length})
        </span>
      </header>

      <div
        className={cn(
          'dashboard-insight-panel-body dashboard-workspace-body',
          queue.length === 0 && 'dashboard-approvals-body--empty',
        )}
      >
        {queue.length === 0 ? (
          <p className="dashboard-workspace-empty dashboard-approvals-empty">
            No pending approvals in queue.
          </p>
        ) : (
          <ul className="dashboard-approvals-list" role="list">
            {queue.map((task, index) => {
              const isLast = index === queue.length - 1
              const busy = processingIds.includes(task.id)
              return (
                <li
                  key={task.id}
                  className={cn('dashboard-approval-card', !isLast && 'dashboard-approval-card--bordered')}
                >
                  <p className="dashboard-approval-title">{task.title}</p>
                  <div className="dashboard-approval-actions-row">
                    <span className="dashboard-approval-age">{task.requestedAgo}</span>
                    <div className="dashboard-approval-buttons">
                      <button
                        type="button"
                        disabled={busy}
                        className="dashboard-approval-action-btn dashboard-approval-action-btn--approve dashboard-approval-action-btn--contrast disabled:opacity-50 disabled:pointer-events-none"
                        onClick={() => void runAction(task, 'approve')}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="dashboard-approval-action-btn dashboard-approval-action-btn--reject dashboard-approval-action-btn--contrast disabled:opacity-50 disabled:pointer-events-none"
                        onClick={() => void runAction(task, 'reject')}
                      >
                        Reject
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
  )
}
