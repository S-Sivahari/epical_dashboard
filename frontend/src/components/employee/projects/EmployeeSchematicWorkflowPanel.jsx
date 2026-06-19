import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@components/ui/Button'
import { cn } from '@/utils/cn'
import { WORK_STAGE_STATUSES } from '@/types/projectWorkspace'
import {
  WORKFLOW_HOLD_LABEL,
  WORKFLOW_HOLD_VALUE,
  WORKFLOW_STATUS_LABELS,
  workStageSelectValue,
  workflowStageStatusClass,
} from '@pages/admin/Projects/projectWorkspaceUi'
import {
  isSchematicReviewStageKey,
  isSchematicStageLocked,
  normalizeSchematicWorkflow,
} from '@pages/admin/Projects/schematicWorkflowUi'
import { updateMySchematicWorkflowStage } from '@services/employeeProjectService'

const STAGE_VISUAL = {
  design: { label: 'DESIGN', dot: '#2563eb' },
  simulation: { label: 'SIMULATION', dot: '#7c3aed' },
  data_collection: { label: 'DATA COLLECTION', dot: '#0d9488' },
  schematic_review: { label: 'REVIEW', dot: '#ea580c' },
}

function getActiveStageKey(workflow) {
  const inProgress = workflow.find((stage) => stage.status === 'in_progress')
  if (inProgress) return inProgress.stageKey
  const pendingReview = workflow.find((stage) => stage.status === 'pending_review')
  if (pendingReview) return pendingReview.stageKey
  return null
}

function stageSelectClass(status, { locked, disabled, readOnly, reviewActionable }) {
  if (status === WORKFLOW_HOLD_VALUE) return 'is-hold'
  if (reviewActionable) return 'is-review-pending'
  if (readOnly && (status === 'approved' || status === 'completed')) return 'is-approved-readonly'
  if (disabled || readOnly || (locked && status === 'not_started')) return 'is-readonly'
  if (status === 'completed' || status === 'approved') return 'is-completed'
  if (status === 'in_progress' || status === 'pending_review') return 'is-progress'
  if (status === 'rejected') return 'is-rejected'
  return 'is-not-started'
}

export function EmployeeSchematicWorkflowPanel({
  cell,
  saving = false,
  canManageWorkflow = false,
  canReview = false,
  onHoldChange,
  onUpdated,
}) {
  const [savingStage, setSavingStage] = useState(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const workflow = normalizeSchematicWorkflow(cell?.schematicWorkflow)
  const activeStageKey = useMemo(() => getActiveStageKey(workflow), [workflow])

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
    setSavingStage(stageKey)
    try {
      const updated = await updateMySchematicWorkflowStage(cell.projectId, cell.id, stageKey, value)
      onUpdated?.(updated)
      toast.success('Schematic stage updated')
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to update schematic stage')
    } finally {
      setSavingStage(null)
    }
  }

  const submitReviewAction = async (status, rejectReturnTo) => {
    if (!canReview) return
    setSavingStage('schematic_review')
    try {
      const updated = await updateMySchematicWorkflowStage(
        cell.projectId,
        cell.id,
        'schematic_review',
        status,
        rejectReturnTo ? { rejectReturnTo } : undefined,
      )
      onUpdated?.(updated)
      setRejectOpen(false)
      toast.success(status === 'approved' ? 'Schematic review approved' : 'Schematic review rejected')
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to update schematic review')
    } finally {
      setSavingStage(null)
    }
  }

  return (
    <div className="admin-projects-workflow-panel is-embedded">
      {cell?.onHold ? (
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
          const isActive = activeStageKey === stage.stageKey
          const isSaving = savingStage === stage.stageKey
          const reviewActionable = isReview && canReview && stage.status === 'pending_review'
          const workEditable = !isReview && canManageWorkflow
          const stageDisabled = saving || isSaving || (!reviewActionable && !workEditable)

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
                    cell?.onHold && !isReview && stage.status === 'in_progress'
                      ? 'is-hold'
                      : workflowStageStatusClass(stage.status),
                  )}
                >
                  {cell?.onHold && !isReview && stage.status === 'in_progress'
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
                          disabled={isSaving}
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
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                      {rejectOpen ? (
                        <div className="admin-projects-workflow-review-return">
                          <p className="admin-projects-workflow-review-return-label">Return to:</p>
                          <div className="admin-projects-workflow-review-return-actions">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={isSaving}
                              onClick={() => void submitReviewAction('rejected', 'design')}
                            >
                              Design
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={isSaving}
                              onClick={() => void submitReviewAction('rejected', 'simulation')}
                            >
                              Simulation
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={isSaving}
                              onClick={() => void submitReviewAction('rejected', 'data_collection')}
                            >
                              Data Collection
                            </Button>
                            <button
                              type="button"
                              className="admin-projects-workflow-review-return-cancel"
                              disabled={isSaving}
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
                          cell?.onHold && stage.status === 'in_progress'
                            ? WORKFLOW_HOLD_VALUE
                            : stage.status,
                          { locked, disabled: stageDisabled || locked, readOnly: !workEditable },
                        ),
                      )}
                      disabled={stageDisabled || locked || !workEditable}
                      value={workStageSelectValue(stage.status, Boolean(cell?.onHold))}
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
                      {workEditable ? (
                        <option value={WORKFLOW_HOLD_VALUE}>{WORKFLOW_HOLD_LABEL}</option>
                      ) : null}
                    </select>
                  </div>
                )}
                {isSaving ? <Loader2 className="admin-projects-workflow-column-spinner" aria-hidden /> : null}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
