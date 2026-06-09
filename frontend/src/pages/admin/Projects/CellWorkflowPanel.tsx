import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/utils/cn'
import { useAuthStore } from '@store/authStore'
import type { CellWorkflowStageKey, ProjectCell, WorkflowStageStatus } from '@/types/projectWorkspace'
import { REVIEW_STAGE_STATUSES, WORK_STAGE_STATUSES } from '@/types/projectWorkspace'
import { updateWorkflowStage } from '@/services/projectWorkspaceService'
import {
  WORKFLOW_STATUS_LABELS,
  isReviewStageKey,
  isStageLocked,
  normalizeCellWorkflow,
  workflowProgressPercent,
  workflowStageStatusClass,
} from './projectWorkspaceUi'

type CellWorkflowPanelProps = {
  projectId: string
  cell: ProjectCell
  onUpdated?: (cell: ProjectCell) => void
  compact?: boolean
  embedded?: boolean
}

export function CellWorkflowPanel({
  projectId,
  cell,
  onUpdated,
  compact = false,
  embedded = false,
}: CellWorkflowPanelProps) {
  const [savingStage, setSavingStage] = useState<CellWorkflowStageKey | null>(null)
  const authRole = useAuthStore((s) => s.role)
  const authUser = useAuthStore((s) => s.user)
  const isAdmin = authRole === 'admin' || authUser?.role === 'Admin'
  const workflow = normalizeCellWorkflow(cell.workflow)
  const progress = workflowProgressPercent(cell)

  const canActionReview = (stageKey: CellWorkflowStageKey, status: WorkflowStageStatus) => {
    if (status === 'pending_review') return true
    const drcFirst = workflow.find((s) => s.stageKey === 'drc_first')
    const lvs = workflow.find((s) => s.stageKey === 'lvs')
    if (stageKey === 'review_1' && status === 'not_started' && drcFirst?.status === 'completed') return true
    if (stageKey === 'review_2' && status === 'not_started' && lvs?.status === 'completed') return true
    return false
  }

  const handleStatusChange = async (stageKey: CellWorkflowStageKey, status: WorkflowStageStatus) => {
    setSavingStage(stageKey)
    try {
      const updated = await updateWorkflowStage(projectId, cell.id, stageKey, status)
      onUpdated?.(updated)
      if (isReviewStageKey(stageKey) && (status === 'approved' || status === 'rejected')) {
        toast.success(status === 'approved' ? 'Review approved' : 'Review rejected')
      } else {
        toast.success('Workflow stage updated')
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Failed to update workflow stage')
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
          {cell.workflowCompletedStages ?? workflow.filter((s) =>
            isReviewStageKey(s.stageKey) ? s.status === 'approved' : s.status === 'completed',
          ).length}/{cell.workflowTotalStages ?? workflow.length}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('admin-projects-workflow-panel', embedded && 'is-embedded')}>
      <div className="admin-projects-workflow-stages">
        {workflow.map((stage, index) => {
          const locked = isStageLocked(workflow, stage.stageKey) && !isReviewStageKey(stage.stageKey)
          const isReview = isReviewStageKey(stage.stageKey)
          const saving = savingStage === stage.stageKey

          return (
            <div
              key={stage.stageKey}
              className={cn(
                'admin-projects-workflow-stage',
                locked && 'is-locked',
              )}
            >
              <div className="admin-projects-workflow-stage-head">
                <span className="admin-projects-workflow-stage-index">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="admin-projects-workflow-stage-title">{stage.stageLabel}</p>
                  <span className={cn(
                    'admin-projects-workflow-stage-chip',
                    workflowStageStatusClass(stage.status),
                    locked && stage.status === 'not_started' && 'is-locked',
                  )}>
                    {locked && stage.status === 'not_started'
                      ? 'Locked'
                      : WORKFLOW_STATUS_LABELS[stage.status]}
                  </span>
                </div>
              </div>

              {isReview ? (
                canActionReview(stage.stageKey, stage.status) && isAdmin ? (
                  <select
                    className="admin-projects-workflow-stage-select"
                    value=""
                    disabled={saving}
                    onChange={(e) => {
                      const value = e.target.value as WorkflowStageStatus
                      if (value) void handleStatusChange(stage.stageKey, value)
                    }}
                    aria-label={`${stage.stageLabel} review action`}
                  >
                    <option value="">{WORKFLOW_STATUS_LABELS.pending_review} — select action</option>
                    <option value="approved">{WORKFLOW_STATUS_LABELS.approved}</option>
                    <option value="rejected">{WORKFLOW_STATUS_LABELS.rejected}</option>
                  </select>
                ) : (
                  <select
                    className="admin-projects-workflow-stage-select"
                    value={stage.status}
                    disabled
                    aria-label={`${stage.stageLabel} review status`}
                  >
                    {REVIEW_STAGE_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {WORKFLOW_STATUS_LABELS[value]}
                      </option>
                    ))}
                  </select>
                )
              ) : (
                <select
                  className="admin-projects-workflow-stage-select"
                  value={stage.status}
                  disabled={locked || saving}
                  onChange={(e) => void handleStatusChange(
                    stage.stageKey,
                    e.target.value as WorkflowStageStatus,
                  )}
                  aria-label={`${stage.stageLabel} status`}
                >
                  {WORK_STAGE_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {WORKFLOW_STATUS_LABELS[value]}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
