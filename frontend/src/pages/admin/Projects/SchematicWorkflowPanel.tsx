import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@components/ui/Button'
import { cn } from '@/utils/cn'
import { useAuthStore } from '@store/authStore'
import type { ProjectCell, WorkflowStageStatus } from '@/types/projectWorkspace'
import { WORK_STAGE_STATUSES } from '@/types/projectWorkspace'
import { setCellHold, updateSchematicWorkflowStage } from '@/services/projectWorkspaceService'
import {
  WORKFLOW_HOLD_LABEL,
  WORKFLOW_HOLD_VALUE,
  WORKFLOW_STATUS_LABELS,
  workStageSelectValue,
  workflowStageStatusClass,
} from './projectWorkspaceUi'
import {
  isSchematicReviewStageKey,
  isSchematicStageLocked,
  normalizeSchematicWorkflow,
  type SchematicWorkflowStageKey,
} from './schematicWorkflowUi'

type SchematicWorkflowPanelProps = {
  projectId: string
  cell: ProjectCell
  onUpdated?: (cell: ProjectCell) => void
  embedded?: boolean
  canReview?: boolean
}

const STAGE_VISUAL: Record<SchematicWorkflowStageKey, { label: string; dot: string }> = {
  design: { label: 'DESIGN', dot: '#2563eb' },
  simulation: { label: 'SIMULATION', dot: '#7c3aed' },
  data_collection: { label: 'DATA COLLECTION', dot: '#0d9488' },
  schematic_review: { label: 'REVIEW', dot: '#ea580c' },
}

const REVIEW_ACTION_OPTIONS: { value: 'approved' | 'rejected'; label: string }[] = [
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function getActiveStageKey(workflow: ReturnType<typeof normalizeSchematicWorkflow>): SchematicWorkflowStageKey | null {
  const inProgress = workflow.find((stage) => stage.status === 'in_progress')
  if (inProgress) return inProgress.stageKey
  const pendingReview = workflow.find((stage) => stage.status === 'pending_review')
  if (pendingReview) return pendingReview.stageKey
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

export function SchematicWorkflowPanel({
  projectId,
  cell,
  onUpdated,
  embedded = false,
  canReview = false,
}: SchematicWorkflowPanelProps) {
  const [savingStage, setSavingStage] = useState<SchematicWorkflowStageKey | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const authRole = useAuthStore((s) => s.role)
  const authUser = useAuthStore((s) => s.user)
  const isAdmin = authRole === 'admin' || authUser?.role === 'Admin'
  const canActionReview = isAdmin || canReview
  const workflow = normalizeSchematicWorkflow(cell.schematicWorkflow)
  const activeStageKey = useMemo(() => getActiveStageKey(workflow), [workflow])

  const handleWorkStageSelect = async (
    stageKey: SchematicWorkflowStageKey,
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
    setSavingStage(stageKey)
    try {
      const updated = await updateSchematicWorkflowStage(
        projectId,
        cell.id,
        stageKey,
        value as WorkflowStageStatus,
      )
      onUpdated?.(updated)
      toast.success('Schematic stage updated')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Failed to update schematic stage')
    } finally {
      setSavingStage(null)
    }
  }

  const submitReviewAction = async (
    status: 'approved' | 'rejected',
    rejectReturnTo?: 'design' | 'simulation' | 'data_collection',
  ) => {
    setSavingStage('schematic_review')
    try {
      const updated = await updateSchematicWorkflowStage(
        projectId,
        cell.id,
        'schematic_review',
        status,
        rejectReturnTo ? { rejectReturnTo } : undefined,
      )
      onUpdated?.(updated)
      setRejectOpen(false)
      toast.success(status === 'approved' ? 'Schematic review approved' : 'Schematic review rejected')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Failed to update schematic review')
    } finally {
      setSavingStage(null)
    }
  }

  return (
    <div className={cn('admin-projects-workflow-panel', embedded && 'is-embedded')}>
      <div className="admin-projects-workflow-board-wrap">
        {cell.onHold ? (
          <p className="admin-projects-workflow-hold-banner" role="status">
            On hold{cell.heldByName ? ` by ${cell.heldByName}` : ''}
            {cell.holdReason ? ` — ${cell.holdReason}` : ''}. Productive time is paused.
          </p>
        ) : null}
        <div className="admin-projects-workflow-board">
          {workflow.map((stage) => {
            const visual = STAGE_VISUAL[stage.stageKey]
            const locked = isSchematicStageLocked(workflow, stage.stageKey)
            const isReview = isSchematicReviewStageKey(stage.stageKey)
            const saving = savingStage === stage.stageKey
            const reviewActionable = isReview && canActionReview && stage.status === 'pending_review'
            const isActive = activeStageKey === stage.stageKey
            const isWorkStage = !isReview

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
                      cell.onHold && isWorkStage && stage.status === 'in_progress'
                        ? 'is-hold'
                        : workflowStageStatusClass(stage.status),
                      locked && stage.status === 'not_started' && 'is-locked',
                    )}
                  >
                    {cell.onHold && isWorkStage && stage.status === 'in_progress'
                      ? 'On Hold'
                      : WORKFLOW_STATUS_LABELS[stage.status]}
                  </span>
                </header>

                <div className="admin-projects-workflow-column-body">
                  {isReview ? (
                    reviewActionable ? (
                      <div className="admin-projects-workflow-review-controls">
                        <div className="admin-projects-workflow-stage-select-wrap">
                          <select
                            className={cn(
                              'admin-projects-workflow-stage-select',
                              stageSelectClass(stage.status, { reviewActionable: true }),
                            )}
                            disabled={saving}
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value === 'approved') {
                                void submitReviewAction('approved')
                              } else if (e.target.value === 'rejected') {
                                setRejectOpen(true)
                              }
                              e.target.value = ''
                            }}
                            aria-label="Schematic review action"
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
                        {rejectOpen ? (
                          <div className="admin-projects-workflow-review-return">
                            <p className="admin-projects-workflow-review-return-label">Return to:</p>
                            <div className="admin-projects-workflow-review-return-actions">
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={saving}
                                onClick={() => void submitReviewAction('rejected', 'design')}
                              >
                                Design
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={saving}
                                onClick={() => void submitReviewAction('rejected', 'simulation')}
                              >
                                Simulation
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={saving}
                                onClick={() => void submitReviewAction('rejected', 'data_collection')}
                              >
                                Data Collection
                              </Button>
                              <button
                                type="button"
                                className="admin-projects-workflow-review-return-cancel"
                                disabled={saving}
                                onClick={() => setRejectOpen(false)}
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
                          aria-label="Schematic review status"
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
                            { locked, disabled: locked || saving },
                          ),
                        )}
                        value={workStageSelectValue(stage.status, Boolean(cell.onHold))}
                        disabled={locked || saving}
                        onChange={(e) => void handleWorkStageSelect(
                          stage.stageKey,
                          e.target.value,
                          stage.status,
                        )}
                        aria-label={`${stage.stageLabel} status`}
                      >
                        {WORK_STAGE_STATUSES.map((value) => (
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
    </div>
  )
}
