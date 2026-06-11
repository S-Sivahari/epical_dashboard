import { useMemo, useState } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import { cn } from '@/utils/cn'
import { WORK_STAGE_STATUSES } from '@/types/projectWorkspace'
import {
  WORKFLOW_STATUS_LABELS,
  isReviewStageKey,
  isStageLocked,
  normalizeCellWorkflow,
  workflowStageStatusClass,
} from '@pages/admin/Projects/projectWorkspaceUi'
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
  if (status === 'approved') return 'Approved'
  if (status === 'completed') return 'Completed'
  if (status === 'in_progress') return 'In Progress'
  if (status === 'pending_review') return 'In Progress'
  if (status === 'rejected') return 'Rejected'
  return 'Not Started'
}

function stageSelectClass(status, { locked, disabled, readOnly }) {
  if (readOnly && status === 'approved') return 'is-approved-readonly'
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

const REVIEW_ACTION_OPTIONS = [
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function canTeamLeadActionReview(workflow, stageKey, status) {
  if (status === 'pending_review' || status === 'approved') return true
  const drcFirst = workflow.find((s) => s.stageKey === 'drc_first')
  const lvs = workflow.find((s) => s.stageKey === 'lvs')
  if (stageKey === 'review_1' && status === 'not_started' && drcFirst?.status === 'completed') return true
  if (stageKey === 'review_2' && status === 'not_started' && lvs?.status === 'completed') return true
  return false
}

function reviewSelectValue(status) {
  if (status === 'approved' || status === 'rejected') return status
  return ''
}

function reviewSelectDisplayStatus(status) {
  if (status === 'approved' || status === 'rejected' || status === 'pending_review') return status
  return 'not_started'
}

export function EmployeeCellWorkflowPanel({
  cell,
  saving = false,
  checklistReady = true,
  isTeamLead = false,
  canManageWorkflow = false,
  openReview = null,
  onWorkStageChange,
  onRequestReview,
  onResolveReview,
}) {
  const [savingStage, setSavingStage] = useState(null)
  const [review2RejectOpen, setReview2RejectOpen] = useState(false)
  const workflow = normalizeCellWorkflow(cell?.workflow)
  const activeStageKey = useMemo(() => getActiveStageKey(workflow), [workflow])
  const reviewPayload = getAdvancePayload(cell, 'layout')
  const canRequestReview = canManageWorkflow && reviewPayload?.type === 'review'
  const blockedByChecklist = canRequestReview && actionRequiresChecklist(cell, reviewPayload) && !checklistReady

  const handleWorkStageChange = async (stageKey, nextStatus) => {
    if (!canManageWorkflow) return
    setSavingStage(stageKey)
    try {
      await onWorkStageChange?.(stageKey, nextStatus)
    } finally {
      setSavingStage(null)
    }
  }

  const handleReviewSelect = async (stageKey, value, currentStatus) => {
    if (!isTeamLead || !openReview) return
    if (value !== 'approved' && value !== 'rejected') return
    if (value === currentStatus) return

    if (stageKey === 'review_2' && value === 'rejected') {
      setReview2RejectOpen(true)
      return
    }

    setSavingStage(stageKey)
    try {
      await onResolveReview?.(openReview.id, value)
    } finally {
      setSavingStage(null)
    }
  }

  return (
    <div className="admin-projects-workflow-panel is-embedded">
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
            const headerBadge = stageHeaderBadge(stage.status, locked)
            const workStageDisabled = !canManageWorkflow || stageSaving || locked
            const reviewActionable = isTeamLead && isReview && canTeamLeadActionReview(workflow, stage.stageKey, stage.status) && openReview
            const showReview2Return = stage.stageKey === 'review_2' && review2RejectOpen && reviewActionable

            return (
              <section
                key={stage.stageKey}
                className={cn(
                  'admin-projects-workflow-column',
                  isActive && 'is-active',
                  locked && 'is-locked',
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
                      workflowStageStatusClass(stage.status),
                      locked && stage.status === 'not_started' && 'is-locked',
                    )}
                  >
                    {headerBadge}
                  </span>
                </header>

                <div className="admin-projects-workflow-column-meta-slot">
                  {meta ? (
                    <p className="admin-projects-workflow-column-meta">{meta}</p>
                  ) : null}
                </div>

                <div className="admin-projects-workflow-column-body">
                  {isReview ? (
                    reviewActionable ? (
                      <div className="admin-projects-workflow-review-controls">
                        <div className="admin-projects-workflow-stage-select-wrap">
                          <select
                            className={cn(
                              'admin-projects-workflow-stage-select',
                              stageSelectClass(stage.status, { readOnly: false }),
                            )}
                            disabled={stageSaving}
                            value={reviewSelectValue(stage.status)}
                            onChange={(e) => {
                              void handleReviewSelect(stage.stageKey, e.target.value, stage.status)
                            }}
                            aria-label={`${stage.stageLabel} review action`}
                          >
                            {stage.status !== 'approved' && stage.status !== 'rejected' ? (
                              <option value="" disabled>
                                Review
                              </option>
                            ) : null}
                            {REVIEW_ACTION_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {showReview2Return ? (
                          <div className="admin-projects-workflow-review-return">
                            <p className="admin-projects-workflow-review-return-label">Return to:</p>
                            <div className="admin-projects-workflow-review-return-actions">
                              <button
                                type="button"
                                className="emp-wf-admin-review-btn emp-wf-admin-review-btn--reject"
                                disabled={stageSaving}
                                onClick={() => void onResolveReview?.(openReview.id, 'rejected', 'floor_plan')}
                              >
                                To Floor Plan
                              </button>
                              <button
                                type="button"
                                className="emp-wf-admin-review-btn emp-wf-admin-review-btn--reject"
                                disabled={stageSaving}
                                onClick={() => void onResolveReview?.(openReview.id, 'rejected', 'routing')}
                              >
                                To Routing
                              </button>
                              <button
                                type="button"
                                className="admin-projects-workflow-review-return-cancel"
                                disabled={stageSaving}
                                onClick={() => setReview2RejectOpen(false)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="admin-projects-workflow-stage-select-wrap">
                        <select
                          className={cn(
                            'admin-projects-workflow-stage-select',
                            stageSelectClass(stage.status, { readOnly: true }),
                          )}
                          value={reviewSelectDisplayStatus(stage.status)}
                          disabled
                          aria-label={`${stage.stageLabel} review status`}
                        >
                          <option value="not_started">{WORKFLOW_STATUS_LABELS.not_started}</option>
                          <option value="pending_review">{WORKFLOW_STATUS_LABELS.pending_review}</option>
                          <option value="approved">{WORKFLOW_STATUS_LABELS.approved}</option>
                          <option value="rejected">{WORKFLOW_STATUS_LABELS.rejected}</option>
                        </select>
                      </div>
                    )
                  ) : (
                  <div className="admin-projects-workflow-stage-select-wrap">
                    <select
                      className={cn(
                        'admin-projects-workflow-stage-select',
                        stageSelectClass(stage.status, {
                          locked,
                          disabled: workStageDisabled,
                          readOnly: workStageDisabled,
                        }),
                      )}
                      value={stage.status}
                      disabled={workStageDisabled}
                      onChange={(e) => {
                        void handleWorkStageChange(stage.stageKey, e.target.value)
                      }}
                      aria-label={`${stage.stageLabel} status`}
                    >
                      {WORK_STAGE_STATUSES.map((value) => (
                        <option key={value} value={value}>
                          {WORKFLOW_STATUS_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </div>
                  )}
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
                : 'Submit for admin review'
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
