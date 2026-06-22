import { useMemo, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { cn } from '@/utils/cn'
import { useAuthStore } from '@store/authStore'
import type { CellReview, CellWorkflowStageKey, ProjectCell, WorkflowStageStatus } from '@/types/projectWorkspace'
import { updateWorkflowStage, setCellHold } from '@/services/projectWorkspaceService'
import {
  WORKFLOW_STATUS_LABELS,
  WORKFLOW_HOLD_LABEL,
  WORKFLOW_HOLD_VALUE,
  editableWorkStageStatuses,
  isReviewStageKey,
  isStageLocked,
  isWorkStageKey,
  normalizeCellWorkflow,
  workStageSelectValue,
  workflowProgressPercent,
  workflowStageStatusClass,
} from './projectWorkspaceUi'
import { CellWorkflowStageTimingMeta } from './CellWorkflowStageTimingMeta'
import { getStageTiming } from '@/utils/cellWorkflowTiming'

type CellWorkflowPanelProps = {
  projectId: string
  cell: ProjectCell
  onUpdated?: (cell: ProjectCell) => void
  compact?: boolean
  embedded?: boolean
  showStages?: boolean
  showReviews?: boolean
  canEdit?: boolean
  reviews?: CellReview[]
  reviewComment?: string
  onReviewCommentChange?: (value: string) => void
  onRequestReview?: () => void | Promise<void>
  onPostReviewReply?: (reviewId: string, body: string) => void | Promise<void>
}

const REVIEW_ACTION_OPTIONS: { value: 'approved' | 'rejected'; label: string }[] = [
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const STAGE_VISUAL: Record<CellWorkflowStageKey, { label: string; dot: string }> = {
  floor_plan: { label: 'FLOOR PLAN', dot: '#334155' },
  drc_first: { label: 'DRC', dot: '#7c3aed' },
  review_1: { label: 'REVIEW 1', dot: '#ea580c' },
  routing: { label: 'ROUTING', dot: '#2563eb' },
  drc_final: { label: 'DRC', dot: '#6d28d9' },
  lvs: { label: 'LVS', dot: '#0d9488' },
  review_2: { label: 'REVIEW 2', dot: '#ea580c' },
}

function stageHeaderBadge(
  status: WorkflowStageStatus,
  locked: boolean,
  reviewActionable?: boolean,
): string {
  if (locked && status === 'not_started') return 'Locked'
  if (reviewActionable && status === 'not_started') return 'In Progress'
  if (status === 'approved') return 'Approved'
  if (status === 'completed') return 'Completed'
  if (status === 'in_progress') return 'In Progress'
  if (status === 'pending_review') return 'In Progress'
  if (status === 'rejected') return 'Rejected'
  return 'Not Started'
}

function getActiveStageKey(workflow: ReturnType<typeof normalizeCellWorkflow>): CellWorkflowStageKey | null {
  const inProgress = workflow.find((stage) => stage.status === 'in_progress')
  if (inProgress) return inProgress.stageKey

  const pendingReview = workflow.find((stage) => stage.status === 'pending_review')
  if (pendingReview) return pendingReview.stageKey

  const rejected = workflow.find((stage) => stage.status === 'rejected')
  if (rejected) return rejected.stageKey

  return null
}

function reviewStageMeta(stageKey: CellWorkflowStageKey, awaitingReview: boolean): string | null {
  if (!awaitingReview) return null
  if (stageKey === 'review_1') return '- Awaiting R1'
  if (stageKey === 'review_2') return '- Awaiting R2'
  return null
}

function stageSelectClass(
  status: WorkflowStageStatus | typeof WORKFLOW_HOLD_VALUE,
  opts: { locked?: boolean; disabled?: boolean; reviewActionable?: boolean },
): string {
  if (status === WORKFLOW_HOLD_VALUE) return 'is-hold'
  if (opts.reviewActionable) return 'is-review-pending'
  if (opts.disabled && status === 'approved') return 'is-approved-readonly'
  if (opts.disabled || (opts.locked && status === 'not_started')) return 'is-readonly'
  if (status === 'completed' || status === 'approved') return 'is-completed'
  if (status === 'in_progress' || status === 'pending_review') return 'is-progress'
  if (status === 'rejected') return 'is-rejected'
  return 'is-not-started'
}

export function CellWorkflowPanel({
  projectId,
  cell,
  onUpdated,
  compact = false,
  embedded = false,
  showStages = true,
  showReviews = true,
  canEdit = true,
  reviews = [],
  reviewComment = '',
  onReviewCommentChange,
  onRequestReview,
  onPostReviewReply,
}: CellWorkflowPanelProps) {
  const [savingStage, setSavingStage] = useState<CellWorkflowStageKey | null>(null)
  const [review2RejectOpen, setReview2RejectOpen] = useState(false)
  const authRole = useAuthStore((s) => s.role)
  const authUser = useAuthStore((s) => s.user)
  const isAdmin = authRole === 'admin' || authUser?.role === 'Admin'
  const canManageStages = canEdit && isAdmin
  const workflow = normalizeCellWorkflow(cell.workflow)
  const progress = workflowProgressPercent(cell)
  const activeStageKey = useMemo(() => getActiveStageKey(workflow), [workflow])

  const canActionReview = (stageKey: CellWorkflowStageKey, status: WorkflowStageStatus) => {
    if (status === 'pending_review' || status === 'approved') return true
    const drcFirst = workflow.find((s) => s.stageKey === 'drc_first')
    const lvs = workflow.find((s) => s.stageKey === 'lvs')
    if (stageKey === 'review_1' && status === 'not_started' && drcFirst?.status === 'completed') return true
    if (stageKey === 'review_2' && status === 'not_started' && lvs?.status === 'completed') return true
    return false
  }

  const reviewSelectValue = (status: WorkflowStageStatus): '' | 'approved' | 'rejected' => {
    if (status === 'approved' || status === 'rejected') return status
    return ''
  }

  const submitReviewAction = async (
    stageKey: CellWorkflowStageKey,
    status: 'approved' | 'rejected',
    rejectReturnTo?: 'floor_plan' | 'routing',
  ) => {
    setSavingStage(stageKey)
    try {
      const updated = await updateWorkflowStage(projectId, cell.id, stageKey, status, {
        rejectReturnTo,
      })
      onUpdated?.(updated)
      setReview2RejectOpen(false)
      toast.success(status === 'approved' ? 'Review approved' : 'Review rejected')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Failed to update workflow stage')
    } finally {
      setSavingStage(null)
    }
  }

  const handleReviewSelect = (
    stageKey: CellWorkflowStageKey,
    value: string,
    currentStatus: WorkflowStageStatus,
  ) => {
    if (value !== 'approved' && value !== 'rejected') return
    if (value === currentStatus) return

    if (stageKey === 'review_2' && value === 'rejected') {
      setReview2RejectOpen(true)
      return
    }

    void submitReviewAction(stageKey, value)
  }

  const handleStatusChange = async (stageKey: CellWorkflowStageKey, status: WorkflowStageStatus) => {
    setSavingStage(stageKey)
    try {
      const updated = await updateWorkflowStage(projectId, cell.id, stageKey, status)
      onUpdated?.(updated)
      toast.success('Workflow stage updated')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Failed to update workflow stage')
    } finally {
      setSavingStage(null)
    }
  }

  const handleWorkStageSelect = async (
    stageKey: CellWorkflowStageKey,
    value: string,
    currentStatus: WorkflowStageStatus,
  ) => {
    if (value === WORKFLOW_HOLD_VALUE) {
      setSavingStage(stageKey)
      try {
        const updated = await setCellHold(projectId, cell.id, { hold: true })
        onUpdated?.(updated)
        toast.success('Cell placed on hold — productive time paused')
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        toast.error(msg || 'Failed to place cell on hold')
      } finally {
        setSavingStage(null)
      }
      return
    }

    if (cell.onHold) {
      setSavingStage(stageKey)
      try {
        const released = await setCellHold(projectId, cell.id, { hold: false })
        onUpdated?.(released)
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        toast.error(msg || 'Failed to release hold')
        setSavingStage(null)
        return
      }
    }

    if (value === currentStatus && !cell.onHold) return
    await handleStatusChange(stageKey, value as WorkflowStageStatus)
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
      {showStages && (
        <div className="admin-projects-workflow-board-wrap">
          {cell.onHold ? (
            <p className="admin-projects-workflow-hold-banner" role="status">
              On hold{cell.heldByName ? ` by ${cell.heldByName}` : ''}
              {cell.holdReason ? ` — ${cell.holdReason}` : ''}. Productive time is paused. Select In Progress to resume.
            </p>
          ) : null}
          <div className="admin-projects-workflow-board">
            {workflow.map((stage) => {
              const visual = STAGE_VISUAL[stage.stageKey]
              const locked = isStageLocked(workflow, stage.stageKey) && !isReviewStageKey(stage.stageKey)
              const isReview = isReviewStageKey(stage.stageKey)
              const saving = savingStage === stage.stageKey
              const reviewActionable = isReview && canActionReview(stage.stageKey, stage.status) && canManageStages
              const showReview2Return =
                stage.stageKey === 'review_2' && review2RejectOpen && reviewActionable
              const isActive = activeStageKey === stage.stageKey
              const awaitingReview = isReview && (stage.status === 'pending_review' || reviewActionable)
              const meta = reviewStageMeta(stage.stageKey, awaitingReview)
              const headerBadge = cell.onHold && isWorkStageKey(stage.stageKey) && stage.status === 'in_progress'
                ? 'On Hold'
                : stageHeaderBadge(stage.status, locked, reviewActionable)
              const badgeClass = cell.onHold && isWorkStageKey(stage.stageKey) && stage.status === 'in_progress'
                ? 'is-hold'
                : reviewActionable && stage.status === 'not_started'
                  ? 'is-progress'
                  : workflowStageStatusClass(stage.status)
              const stageTiming = getStageTiming(cell.workflowTiming, stage.stageKey)

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
                        style={{ backgroundColor: visual.dot }}
                        aria-hidden
                      />
                      {visual.label}
                    </span>
                    <span
                      className={cn(
                        'admin-projects-workflow-column-badge',
                        badgeClass,
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
                    <CellWorkflowStageTimingMeta
                      timing={stageTiming}
                      status={stage.status}
                      compact
                    />
                  </div>

                  <div className="admin-projects-workflow-column-body">
                    {isReview ? (
                      reviewActionable ? (
                        <div className="admin-projects-workflow-review-controls">
                          <div className="admin-projects-workflow-stage-select-wrap">
                            <select
                              key={`${stage.stageKey}-${review2RejectOpen ? 'open' : 'closed'}-${stage.status}`}
                              className={cn(
                                'admin-projects-workflow-stage-select',
                                stageSelectClass(stage.status, { reviewActionable: true }),
                              )}
                              disabled={saving}
                              value={reviewSelectValue(stage.status)}
                              onChange={(e) => {
                                handleReviewSelect(stage.stageKey, e.target.value, stage.status)
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
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={saving}
                                  onClick={() => void submitReviewAction('review_2', 'rejected', 'floor_plan')}
                                >
                                  To Floor Plan
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={saving}
                                  onClick={() => void submitReviewAction('review_2', 'rejected', 'routing')}
                                >
                                  To Routing
                                </Button>
                                <button
                                  type="button"
                                  className="admin-projects-workflow-review-return-cancel"
                                  disabled={saving}
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
                              stageSelectClass(stage.status, { disabled: true }),
                            )}
                            value={stage.status}
                            disabled
                            aria-label={`${stage.stageLabel} review status`}
                          >
                            <option value={stage.status}>{WORKFLOW_STATUS_LABELS[stage.status]}</option>
                          </select>
                        </div>
                      )
                    ) : (
                      <div className="admin-projects-workflow-stage-select-wrap">
                        <select
                          className={cn(
                            'admin-projects-workflow-stage-select',
                            stageSelectClass(
                              cell.onHold && stage.status === 'in_progress'
                                ? WORKFLOW_HOLD_VALUE
                                : stage.status,
                              { locked, disabled: !canEdit || locked || saving },
                            ),
                          )}
                          value={workStageSelectValue(stage.status, Boolean(cell.onHold))}
                          disabled={!canEdit || locked || saving}
                          onChange={(e) => void handleWorkStageSelect(
                            stage.stageKey,
                            e.target.value,
                            stage.status,
                          )}
                          aria-label={`${stage.stageLabel} status`}
                        >
                          {editableWorkStageStatuses(stage.status).map((value) => (
                            <option key={value} value={value}>
                              {WORKFLOW_STATUS_LABELS[value]}
                            </option>
                          ))}
                          <option value={WORKFLOW_HOLD_VALUE}>{WORKFLOW_HOLD_LABEL}</option>
                        </select>
                      </div>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}

      {showReviews && onRequestReview && (
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
