import {
  getViewProgressStatus,
  LAYOUT_STAGE_LABELS,
  SCHEMATIC_STAGE_LABELS,
  VIEW_TABS,
  normalizeWorkflow,
} from '@/utils/cellWorkflowUi'
import { normalizeSchematicWorkflow } from '@pages/admin/Projects/schematicWorkflowUi'
import { ViewProgressStatusBadge } from './ViewProgressStatusBadge'
import { cn } from '@pages/employee/lib/utils'

function viewStageLabel(cell, viewTab) {
  const wf = normalizeWorkflow(cell?.viewWorkflow)
  if (viewTab === 'symbol') {
    return VIEW_TABS.find((tab) => tab.id === viewTab)?.label || viewTab
  }
  if (viewTab === 'schematic' || viewTab === 'style') {
    const pipeline = normalizeSchematicWorkflow(cell?.schematicWorkflow)
    const active = pipeline.find((stage) =>
      stage.stageKey !== 'schematic_review'
      && (stage.status === 'in_progress' || stage.status === 'not_started'),
    )
    if (active) return SCHEMATIC_STAGE_LABELS[active.stageKey] || active.stageLabel
    const review = pipeline.find((s) => s.stageKey === 'schematic_review')
    if (review?.status === 'pending_review' || review?.status === 'approved') return 'Review'
    return SCHEMATIC_STAGE_LABELS[wf.schematic.stage] || 'Schematic'
  }
  return LAYOUT_STAGE_LABELS[wf.layout.stage] || wf.layout.stage
}

export function CellStageStatusRow({ cell, viewTab = 'layout', className }) {
  const wf = normalizeWorkflow(cell?.viewWorkflow)
  const stageLabel = viewStageLabel(cell, viewTab)
  const status = getViewProgressStatus(cell, viewTab)
  const pendingReview =
    (viewTab === 'layout' && wf.layout.pendingReview)
    || ((viewTab === 'schematic' || viewTab === 'style')
      && normalizeSchematicWorkflow(cell?.schematicWorkflow).find((s) => s.stageKey === 'schematic_review')?.status === 'pending_review')

  return (
    <div className={cn('emp-wf-stage-status-row', className)}>
      <span className="emp-wf-stage-label">
        {stageLabel}
        {pendingReview ? (
          <span className="emp-wf-stage-review-hint">
            {viewTab === 'layout'
              ? ` · Awaiting ${pendingReview.toUpperCase()}`
              : ' · Awaiting review'}
          </span>
        ) : null}
      </span>
      <ViewProgressStatusBadge status={status} />
    </div>
  )
}
