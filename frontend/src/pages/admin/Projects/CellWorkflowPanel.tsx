import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@components/ui/Button'
import { cn } from '@/utils/cn'
import { useAuthStore } from '@store/authStore'
import type { CellWorkflowStageKey, ProjectCell, WorkflowStageStatus } from '@/types/projectWorkspace'
import { WORK_STAGE_STATUSES } from '@/types/projectWorkspace'
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

function stageHeaderBadge(status: WorkflowStageStatus, locked: boolean): string {
  if (locked && status === 'not_started') return 'Locked'
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
  status: WorkflowStageStatus,
  opts: { locked?: boolean; disabled?: boolean; reviewActionable?: boolean },
): string {
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
}: CellWorkflowPanelProps) {
  const [savingStage, setSavingStage] = useState<CellWorkflowStageKey | null>(null)
  const [review2RejectOpen, setReview2RejectOpen] = useState(false)
  const authRole = useAuthStore((s) => s.role)
  const authUser = useAuthStore((s) => s.user)
  const isAdmin = authRole === 'admin' || authUser?.role === 'Admin'
  const workflow = normalizeCellWorkflow(cell.workflow)
  const progress = workflowProgressPercent(cell)
  const activeStageKey = useMemo(() => getActiveStageKey(workflow), [workflow])

  const canActionReview = (stageKey: CellWorkflowStageKey, status: WorkflowStageStatus) => {
    if (status === 'pending_review') return true
    const drcFirst = workflow.find((s) => s.stageKey === 'drc_first')
    const lvs = workflow.find((s) => s.stageKey === 'lvs')
    if (stageKey === 'review_1' && status === 'not_started' && drcFirst?.status === 'completed') return true
    if (stageKey === 'review_2' && status === 'not_started' && lvs?.status === 'completed') return true
    return false
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

  const handleReviewSelect = (stageKey: CellWorkflowStageKey, value: string) => {
    if (value !== 'approved' && value !== 'rejected') return

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
      <div className="admin-projects-workflow-board-wrap">
        <div className="admin-projects-workflow-board">
          {workflow.map((stage) => {
            const visual = STAGE_VISUAL[stage.stageKey]
            const locked = isStageLocked(workflow, stage.stageKey) && !isReviewStageKey(stage.stageKey)
            const isReview = isReviewStageKey(stage.stageKey)
            const saving = savingStage === stage.stageKey
            const reviewActionable = isReview && canActionReview(stage.stageKey, stage.status) && isAdmin
            const showReview2Return =
              stage.stageKey === 'review_2' && review2RejectOpen && reviewActionable
            const isActive = activeStageKey === stage.stageKey
            const awaitingReview = isReview && (stage.status === 'pending_review' || reviewActionable)
            const meta = reviewStageMeta(stage.stageKey, awaitingReview)
            const headerBadge = stageHeaderBadge(stage.status, locked)

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
                            key={`${stage.stageKey}-${review2RejectOpen ? 'open' : 'closed'}`}
                            className={cn(
                              'admin-projects-workflow-stage-select',
                              stageSelectClass(stage.status, { reviewActionable: true }),
                            )}
                            disabled={saving}
                            defaultValue=""
                            onChange={(e) => {
                              handleReviewSelect(stage.stageKey, e.target.value)
                            }}
                            aria-label={`${stage.stageLabel} review action`}
                          >
                            <option value="" disabled>
                              Review
                            </option>
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
                          stageSelectClass(stage.status, { locked, disabled: locked || saving }),
                        )}
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
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
