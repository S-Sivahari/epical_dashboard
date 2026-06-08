import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useLeaves } from '@hooks/useLeaves'
import {
  approveDocumentRequest,
  rejectDocumentRequest,
} from '@services/documentRequestService'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { cn } from '@/utils/cn'
import type { PendingApprovalTask } from './dashboardRightWorkspaceData'

type DashboardPendingApprovalsPanelProps = {
  tasks: PendingApprovalTask[]
  className?: string
}

function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
  return typeof data === 'string' && data.trim() ? data : fallback
}

export function DashboardPendingApprovalsPanel({
  tasks,
  className,
}: DashboardPendingApprovalsPanelProps) {
  const { approveLeave, rejectLeave } = useLeaves()
  const [queue, setQueue] = useState<PendingApprovalTask[]>(tasks)
  const processingRef = useRef(new Set<string>())
  const [processingIds, setProcessingIds] = useState<string[]>([])
  const [rejectTarget, setRejectTarget] = useState<PendingApprovalTask | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')
  const [rejectSubmitting, setRejectSubmitting] = useState(false)

  useEffect(() => {
    setQueue((prev) => {
      const inFlight = processingRef.current
      const next = tasks.filter((t) => !inFlight.has(t.id))
      if (inFlight.size === 0) return next
      const nextIds = new Set(next.map((t) => t.id))
      return prev.filter((t) => inFlight.has(t.id) || nextIds.has(t.id))
    })
  }, [tasks])

  const openRejectModal = (task: PendingApprovalTask) => {
    setRejectTarget(task)
    setRejectReason('')
    setRejectError('')
  }

  const closeRejectModal = () => {
    if (rejectSubmitting) return
    setRejectTarget(null)
    setRejectReason('')
    setRejectError('')
  }

  const runApprove = useCallback(
    async (task: PendingApprovalTask) => {
      if (processingRef.current.has(task.id)) return

      if (task.kind === 'document' && !task.hasFulfillmentFile) {
        toast.error('Upload the fulfillment file on the Documents page before approving.')
        return
      }

      processingRef.current.add(task.id)
      setProcessingIds((prev) => (prev.includes(task.id) ? prev : [...prev, task.id]))
      setQueue((prev) => prev.filter((item) => item.id !== task.id))

      try {
        if (task.kind === 'leave') {
          await approveLeave(task.sourceId)
          toast.success('Leave request approved')
        } else {
          await approveDocumentRequest(task.sourceId)
          toast.success('Document request approved')
        }
      } catch (err) {
        toast.error(getErrorMessage(err, 'Approval failed'))
        setQueue((prev) => (prev.some((i) => i.id === task.id) ? prev : [...prev, task]))
      } finally {
        processingRef.current.delete(task.id)
        setProcessingIds((prev) => prev.filter((id) => id !== task.id))
      }
    },
    [approveLeave],
  )

  const submitReject = async () => {
    if (!rejectTarget) return
    const reason = rejectReason.trim()
    if (!reason) {
      setRejectError('Rejection reason is required.')
      return
    }
    if (reason.length > 500) {
      setRejectError('Rejection reason must be under 500 characters.')
      return
    }

    const task = rejectTarget
    setRejectError('')
    setRejectSubmitting(true)
    processingRef.current.add(task.id)
    setProcessingIds((prev) => (prev.includes(task.id) ? prev : [...prev, task.id]))
    setQueue((prev) => prev.filter((item) => item.id !== task.id))
    setRejectTarget(null)

    try {
      if (task.kind === 'leave') {
        await rejectLeave(task.sourceId, reason)
        toast.success('Leave request rejected')
      } else {
        await rejectDocumentRequest(task.sourceId, reason)
        toast.success('Document request rejected')
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Rejection failed'))
      setQueue((prev) => (prev.some((i) => i.id === task.id) ? prev : [...prev, task]))
    } finally {
      setRejectSubmitting(false)
      setRejectReason('')
      processingRef.current.delete(task.id)
      setProcessingIds((prev) => prev.filter((id) => id !== task.id))
    }
  }

  return (
    <>
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
                const docNeedsUpload = task.kind === 'document' && !task.hasFulfillmentFile
                return (
                  <li
                    key={task.id}
                    className={cn('dashboard-approval-card', !isLast && 'dashboard-approval-card--bordered')}
                  >
                    <p className="dashboard-approval-title">{task.title}</p>
                    {docNeedsUpload ? (
                      <p className="dashboard-approval-hint text-xs font-medium text-amber-800">
                        Upload fulfillment file in Documents before approving.
                      </p>
                    ) : null}
                    <div className="dashboard-approval-actions-row">
                      <span className="dashboard-approval-age">{task.requestedAgo}</span>
                      <div className="dashboard-approval-buttons">
                        <button
                          type="button"
                          disabled={busy || docNeedsUpload}
                          title={
                            docNeedsUpload
                              ? 'Upload fulfillment file in Documents first'
                              : undefined
                          }
                          className="dashboard-approval-action-btn dashboard-approval-action-btn--approve dashboard-approval-action-btn--contrast disabled:pointer-events-none disabled:opacity-50"
                          onClick={() => void runApprove(task)}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className="dashboard-approval-action-btn dashboard-approval-action-btn--reject dashboard-approval-action-btn--contrast disabled:pointer-events-none disabled:opacity-50"
                          onClick={() => openRejectModal(task)}
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

      <Modal
        isOpen={!!rejectTarget}
        onClose={closeRejectModal}
        title={rejectTarget ? `Reject ${rejectTarget.kind === 'leave' ? 'leave' : 'document'} request` : 'Reject request'}
        size="md"
      >
        <p className="mb-3 text-sm leading-relaxed text-slate-600">
          {rejectTarget
            ? `Provide a reason for rejecting "${rejectTarget.title}". The employee will see this message.`
            : ''}
        </p>
        <label className="block text-xs font-bold uppercase tracking-wide text-slate-600">
          Reason for rejection <span className="text-danger">*</span>
        </label>
        <textarea
          className="admin-documents-textarea mt-2 min-h-[6.5rem] w-full rounded-lg border px-3 py-2.5 text-sm text-ink shadow-sm outline-none"
          value={rejectReason}
          onChange={(e) => {
            setRejectReason(e.target.value)
            if (rejectError) setRejectError('')
          }}
          placeholder="e.g. Missing information required to process this request..."
          disabled={rejectSubmitting}
        />
        {rejectError ? (
          <p className="mt-1.5 text-xs font-medium text-danger">{rejectError}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={closeRejectModal} disabled={rejectSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={rejectSubmitting || !rejectReason.trim()}
            loading={rejectSubmitting}
            onClick={() => void submitReject()}
          >
            Reject request
          </Button>
        </div>
      </Modal>
    </>
  )
}
