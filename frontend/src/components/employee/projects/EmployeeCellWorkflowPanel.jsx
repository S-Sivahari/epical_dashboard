import { useMemo, useState } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import { cn } from '@/utils/cn'
import { WORK_STAGE_STATUSES } from '@/types/projectWorkspace'
import {
  WORKFLOW_STATUS_LABELS,
  WORKFLOW_HOLD_LABEL,
  WORKFLOW_HOLD_VALUE,
  isReviewStageKey,
  isStageLocked,
  isWorkStageKey,
  normalizeCellWorkflow,
  workStageSelectValue,
  workflowStageStatusClass,
} from '@pages/admin/Projects/projectWorkspaceUi'
import { CellWorkflowStageTimingMeta } from '@pages/admin/Projects/CellWorkflowStageTimingMeta'
import { getStageTiming } from '@/utils/cellWorkflowTiming'
import {
  actionRequiresChecklist,
  getAdvancePayload,
} from '@/utils/cellWorkflowUi'

const STAGE_VISUAL = {
  floor_plan: { label: 'FLOOR PLAN', dot: '#334155' },
  drc_first: { label: 'DRC', dot: '#7c3aed' },
  review_1: { label: 'REVIEW 1', dot: '#ea580c' },
  routing: { label: 'ROUTING', dot: '#2563eb' },
  drc_final: { label: 'DRC', dot: '#6d28d9' },
  lvs: { label: 'LVS', dot: '#0d9488' },
  review_2: { label: 'REVIEW 2', dot: '#ea580c' },
}

function stageHeaderBadge(status, locked) {
  if (locked && status === 'not_started') return 'Locked'
  if (status === 'approved') return 'Completed'
  if (status === 'completed') return 'Completed'
  if (status === 'in_progress') return 'In Progress'
  if (status === 'pending_review') return 'In Progress'
  if (status === 'rejected') return 'Not Started'
  return 'Not Started'
}

function stageSelectClass(status, { locked, disabled, readOnly }) {
  if (status === WORKFLOW_HOLD_VALUE) return 'is-hold'
  if (readOnly && (status === 'approved' || status === 'completed')) return 'is-approved-readonly'
  if (disabled || readOnly || (locked && status === 'not_started')) return 'is-readonly'
  if (status === 'completed' || status === 'approved') return 'is-completed'
  if (status === 'in_progress' || status === 'pending_review') return 'is-progress'
  if (status === 'rejected') return 'is-rejected'
  return 'is-not-started'
}

function getActiveStageKey(workflow) {
  const inProgress = workflow.find((stage) => stage.status === 'in_progress')
  if (inProgress) return inProgress.stageKey

  const pendingReview = workflow.find((stage) => stage.status === 'pending_review')
  if (pendingReview) return pendingReview.stageKey

  const rejected = workflow.find((stage) => stage.status === 'rejected')
  if (rejected) return rejected.stageKey

  return null
}

function reviewStageMeta(stageKey, awaitingReview) {
  if (!awaitingReview) return null
  if (stageKey === 'review_1') return '- Awaiting R1'
  if (stageKey === 'review_2') return '- Awaiting R2'
  return null
}

function reviewStatusToSelectValue(status) {
  if (status === 'approved' || status === 'completed') return 'completed'
  if (status === 'pending_review' || status === 'in_progress') return 'in_progress'
  return 'not_started'
}

export function EmployeeCellWorkflowPanel({
  cell,
  saving = false,
  checklistReady = true,
  canManageWorkflow = false,
  canReview = false,
  onWorkStageChange,
  onHoldChange,
  onRequestReview,
}) {
  const [savingStage, setSavingStage] = useState(null)
  const workflow = normalizeCellWorkflow(cell?.workflow)
  const activeStageKey = useMemo(() => getActiveStageKey(workflow), [workflow])
  const reviewPayload = getAdvancePayload(cell, 'layout')
  const canRequestReview = canManageWorkflow && reviewPayload?.type === 'review'
  const blockedByChecklist = canRequestReview && actionRequiresChecklist(cell, reviewPayload) && !checklistReady

  const handleStageChange = async (stageKey, nextStatus) => {
    const isReview = isReviewStageKey(stageKey)
    if (isReview && !canReview) return
    if (!isReview && !canManageWorkflow) return

    setSavingStage(stageKey)
    try {
      await onWorkStageChange?.(stageKey, nextStatus)
    } finally {
      setSavingStage(null)
    }
  }

  const handleWorkStageSelect = async (stageKey, value, currentStatus) => {
    if (!canManageWorkflow) return

    if (value === WORKFLOW_HOLD_VALUE) {
      setSavingStage(stageKey)
      try {
        await onHoldChange?.(true)
      } finally {
        setSavingStage(null)
      }
      return
    }

    if (cell?.onHold) {
      setSavingStage(stageKey)
      try {
        await onHoldChange?.(false)
      } finally {
        setSavingStage(null)
      }
    }

    if (value === currentStatus && !cell?.onHold) return
    await handleStageChange(stageKey, value)
  }

  return (
    <div className="admin-projects-workflow-panel is-embedded">
      {cell?.onHold ? (
        <p className="admin-projects-workflow-hold-banner" role="status">
          On hold{cell.heldByName ? ` by ${cell.heldByName}` : ''}
          {cell.holdReason ? ` — ${cell.holdReason}` : ''}. Productive time is paused. Select In Progress to resume.
        </p>
      ) : null}
      <div className="admin-projects-workflow-board-wrap">
        <div className="admin-projects-workflow-board">
          {workflow.map((stage) => {
            const visual = STAGE_VISUAL[stage.stageKey]
            const locked = isStageLocked(workflow, stage.stageKey) && !isReviewStageKey(stage.stageKey)
            const isReview = isReviewStageKey(stage.stageKey)
            const stageSaving = savingStage === stage.stageKey || saving
            const isActive = activeStageKey === stage.stageKey
            const awaitingReview = isReview && stage.status === 'pending_review'
            const meta = reviewStageMeta(stage.stageKey, awaitingReview)
            const headerBadge = cell?.onHold && isWorkStageKey(stage.stageKey) && stage.status === 'in_progress'
              ? 'On Hold'
              : stageHeaderBadge(stage.status, locked)
            const reviewEditable = isReview && canReview
            const workEditable = !isReview && canManageWorkflow
            const stageDisabled = stageSaving || (!reviewEditable && !workEditable) || (!isReview && locked)
            const stageTiming = getStageTiming(cell?.workflowTiming, stage.stageKey)

            return (
              <section
                key={stage.stageKey}
                className={cn(
                  'admin-projects-workflow-column',
                  isActive && 'is-active',
                  locked && !isReview && 'is-locked',
                  isReview && 'is-review',
                )}
              >
                <header className="admin-projects-workflow-column-head">
                  <span className="admin-projects-workflow-column-label">
                    <span
                      className="admin-projects-workflow-column-dot"
                      style={{ backgroundColor: visual?.dot || '#64748b' }}
                      aria-hidden
                    />
                    {visual?.label || stage.stageLabel}
                  </span>
                  <span
                    className={cn(
                      'admin-projects-workflow-column-badge',
                      cell?.onHold && isWorkStageKey(stage.stageKey) && stage.status === 'in_progress'
                        ? 'is-hold'
                        : workflowStageStatusClass(isReview ? reviewStatusToSelectValue(stage.status) : stage.status),
                      locked && !isReview && stage.status === 'not_started' && 'is-locked',
                    )}
                  >
                    {headerBadge}
                  </span>
                </header>

                <div className="admin-projects-workflow-column-meta-slot">
                  {meta ? (
                    <p className="admin-projects-workflow-column-meta">{meta}</p>
                  ) : null}
                  <CellWorkflowStageTimingMeta
                    timing={stageTiming}
                    status={stage.status}
                    compact
                  />
                </div>

                <div className="admin-projects-workflow-column-body">
                  <div className="admin-projects-workflow-stage-select-wrap">
                    <select
                      className={cn(
                        'admin-projects-workflow-stage-select',
                        stageSelectClass(
                          !isReview && cell?.onHold && stage.status === 'in_progress'
                            ? WORKFLOW_HOLD_VALUE
                            : (isReview ? reviewStatusToSelectValue(stage.status) : stage.status),
                          {
                            locked: !isReview && locked,
                            disabled: stageDisabled,
                            readOnly: stageDisabled,
                          },
                        ),
                      )}
                      value={
                        isReview
                          ? reviewStatusToSelectValue(stage.status)
                          : workStageSelectValue(stage.status, Boolean(cell?.onHold))
                      }
                      disabled={stageDisabled}
                      onChange={(e) => {
                        if (isReview) {
                          void handleStageChange(stage.stageKey, e.target.value)
                        } else {
                          void handleWorkStageSelect(stage.stageKey, e.target.value, stage.status)
                        }
                      }}
                      aria-label={`${stage.stageLabel} status`}
                    >
                      {WORK_STAGE_STATUSES.map((value) => (
                        <option key={value} value={value}>
                          {WORKFLOW_STATUS_LABELS[value]}
                        </option>
                      ))}
                      {!isReview && workEditable ? (
                        <option value={WORKFLOW_HOLD_VALUE}>{WORKFLOW_HOLD_LABEL}</option>
                      ) : null}
                    </select>
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      </div>

      {canRequestReview ? (
        <div className="admin-projects-workflow-reviews">
          <div className="admin-projects-workflow-reviews-head">
            <MessageSquare className="h-4 w-4" aria-hidden />
            <h3 className="admin-projects-workflow-reviews-title">Request review</h3>
          </div>
          <button
            type="button"
            className="admin-projects-workflow-review-request-btn"
            disabled={saving || blockedByChecklist}
            title={
              blockedByChecklist
                ? 'Complete the checklist and final cell details before requesting review'
                : 'Submit for team lead review'
            }
            onClick={() => void onRequestReview?.(cell)}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Request review'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
