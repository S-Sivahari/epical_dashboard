import {
  getViewProgressStatus,
  LAYOUT_STAGE_LABELS,
  normalizeWorkflow,
  VIEW_TABS,
} from '@/utils/cellWorkflowUi'
import { ViewProgressStatusBadge } from './ViewProgressStatusBadge'
import { cn } from '@pages/employee/lib/utils'

function viewStageLabel(cell, viewTab) {
  const wf = normalizeWorkflow(cell?.viewWorkflow)
  if (viewTab === 'style' || viewTab === 'symbol') {
    return VIEW_TABS.find((tab) => tab.id === viewTab)?.label || viewTab
  }
  return LAYOUT_STAGE_LABELS[wf.layout.stage] || wf.layout.stage
}

export function CellStageStatusRow({ cell, viewTab = 'layout', className }) {
  const wf = normalizeWorkflow(cell?.viewWorkflow)
  const stageLabel = viewStageLabel(cell, viewTab)
  const status = getViewProgressStatus(cell, viewTab)
  const pendingReview = viewTab === 'layout' && wf.layout.pendingReview

  return (
    <div className={cn('emp-wf-stage-status-row', className)}>
      <span className="emp-wf-stage-label">
        {stageLabel}
        {pendingReview ? (
          <span className="emp-wf-stage-review-hint"> · Awaiting {pendingReview.toUpperCase()}</span>
        ) : null}
      </span>
      <ViewProgressStatusBadge status={status} />
    </div>
  )
}
