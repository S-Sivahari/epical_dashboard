import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { cn } from '@/utils/cn'
import type { CellReview, CellWorkflowStageKey, ProjectCell, WorkflowStageStatus } from '@/types/projectWorkspace'
import { updateWorkflowStage } from '@/services/projectWorkspaceService'
import {
  WORKFLOW_STATUS_LABELS,
  normalizeCellWorkflow,
  workflowProgressPercent,
  workflowStageStatusClass,
} from './projectWorkspaceUi'

type CellWorkflowPanelProps = {
  projectId: string
  cell: ProjectCell
  onUpdated?: (cell: ProjectCell) => void
  compact?: boolean
  reviews?: CellReview[]
  reviewComment?: string
  onReviewCommentChange?: (value: string) => void
  onRequestReview?: () => void | Promise<void>
  onPostReviewReply?: (reviewId: string, body: string) => void | Promise<void>
}

export function CellWorkflowPanel({
  projectId,
  cell,
  onUpdated,
  compact = false,
  reviews = [],
  reviewComment = '',
  onReviewCommentChange,
  onRequestReview,
  onPostReviewReply,
}: CellWorkflowPanelProps) {
  const [savingStage, setSavingStage] = useState<CellWorkflowStageKey | null>(null)
  const workflow = normalizeCellWorkflow(cell.workflow)
  const progress = workflowProgressPercent(cell)

  const handleStatusChange = async (stageKey: CellWorkflowStageKey, status: WorkflowStageStatus) => {
    setSavingStage(stageKey)
    try {
      const updated = await updateWorkflowStage(projectId, cell.id, stageKey, status)
      onUpdated?.(updated)
      toast.success('Workflow stage updated')
    } catch {
      toast.error('Failed to update workflow stage')
    } finally {
      setSavingStage(null)
    }
  }

  if (compact) {
    return (
      <div className="admin-projects-workflow-compact">
        <div className="admin-projects-workflow-compact-bar" aria-hidden>
          <span className="admin-projects-workflow-compact-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="admin-projects-workflow-compact-text">
          {cell.workflowCompletedStages ?? workflow.filter((s) => s.status === 'completed').length}/{cell.workflowTotalStages ?? workflow.length}
        </span>
      </div>
    )
  }

  return (
    <div className="admin-projects-workflow-panel">
      <div className="admin-projects-workflow-stages">
        {workflow.map((stage, index) => (
          <div key={stage.stageKey} className="admin-projects-workflow-stage">
            <div className="admin-projects-workflow-stage-head">
              <span className="admin-projects-workflow-stage-index">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="admin-projects-workflow-stage-title">{stage.stageLabel}</p>
                <span className={cn(
                  'admin-projects-workflow-stage-chip',
                  workflowStageStatusClass(stage.status),
                )}>
                  {WORKFLOW_STATUS_LABELS[stage.status]}
                </span>
              </div>
            </div>
            <select
              className="admin-projects-workflow-stage-select"
              value={stage.status}
              disabled={savingStage === stage.stageKey}
              onChange={(e) => void handleStatusChange(stage.stageKey, e.target.value as WorkflowStageStatus)}
              aria-label={`${stage.stageLabel} status`}
            >
              {(Object.keys(WORKFLOW_STATUS_LABELS) as WorkflowStageStatus[]).map((status) => (
                <option key={status} value={status}>{WORKFLOW_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {onRequestReview && (
        <div className="admin-projects-workflow-reviews">
          <div className="admin-projects-workflow-reviews-head">
            <MessageSquare className="h-4 w-4" aria-hidden />
            <h3 className="admin-projects-workflow-reviews-title">Reviews</h3>
          </div>
          <div className="flex gap-2">
            <Input
              className="flex-1"
              placeholder="Request review or add comment…"
              value={reviewComment}
              onChange={(e) => onReviewCommentChange?.(e.target.value)}
            />
            <Button onClick={() => void onRequestReview()}>Request review</Button>
          </div>
          {reviews.map((review) => (
            <div key={review.id} className="admin-projects-workflow-review-card">
              <p className="admin-projects-workflow-review-meta">
                {review.initiatedByName} · stage {review.stageAtRequest} · {review.status}
              </p>
              <ul className="admin-projects-workflow-review-messages">
                {review.messages.map((msg, i) => (
                  <li key={i} className="admin-projects-workflow-review-message">
                    <span className="font-semibold">{msg.authorName}</span> ({msg.authorRole}): {msg.body}
                  </li>
                ))}
              </ul>
              {review.status === 'open' && onPostReviewReply && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => {
                    const body = window.prompt('Reply')
                    if (body) void onPostReviewReply(review.id, body)
                  }}
                >
                  Reply
                </Button>
              )}
            </div>
          ))}
          {reviews.length === 0 && (
            <p className="admin-projects-workflow-reviews-empty">No reviews yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
