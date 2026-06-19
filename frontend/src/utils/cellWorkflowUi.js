import {
  isSchematicReviewStageKey,
  normalizeSchematicWorkflow,
} from '@pages/admin/Projects/schematicWorkflowUi'

export const VIEW_PROGRESS_LABELS = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
}

export const LAYOUT_STAGE_LABELS = {
  floor_plan: 'Floor Plan',
  drc_r1: 'DRC (R1)',
  routing: 'Routing',
  drc: 'DRC',
  lvs_r2: 'LVS (R2)',
}

export const SCHEMATIC_STAGE_LABELS = {
  design: 'Design',
  simulation: 'Simulation',
  data_collection: 'Data Collection',
  review: 'Review',
}

/** Strict layout pipeline — no other order allowed */
export const LAYOUT_STAGES = ['floor_plan', 'drc_r1', 'routing', 'drc', 'lvs_r2']

export const SCHEMATIC_PIPELINE_STAGES = ['design', 'simulation', 'data_collection', 'review']

export const VIEW_TABS = [
  { id: 'schematic', label: 'Schematic' },
  { id: 'symbol', label: 'Symbol' },
  { id: 'layout', label: 'Layout' },
]

export const SIMPLE_VIEW_COLUMNS = [
  { id: 'not_started', label: 'Not Started', dot: '#475569', pill: 'emp-wf-pill--slate' },
  { id: 'in_progress', label: 'In Progress', dot: '#2563eb', pill: 'emp-wf-pill--blue' },
  { id: 'completed', label: 'Completed', dot: '#16a34a', pill: 'emp-wf-pill--green' },
]

/** One Kanban column per layout stage, in pipeline order only */
export const LAYOUT_KANBAN_COLUMNS = [
  { id: 'floor_plan', label: 'Floor Plan', dot: '#475569', pill: 'emp-wf-pill--slate' },
  { id: 'drc_r1', label: 'DRC (R1)', dot: '#7c3aed', pill: 'emp-wf-pill--purple' },
  { id: 'routing', label: 'Routing', dot: '#2563eb', pill: 'emp-wf-pill--blue' },
  { id: 'drc', label: 'DRC', dot: '#6d28d9', pill: 'emp-wf-pill--purple' },
  { id: 'lvs_r2', label: 'LVS (R2)', dot: '#0d9488', pill: 'emp-wf-pill--teal' },
]

export const SCHEMATIC_KANBAN_COLUMNS = [
  { id: 'design', label: 'Design', dot: '#2563eb', pill: 'emp-wf-pill--blue' },
  { id: 'simulation', label: 'Simulation', dot: '#7c3aed', pill: 'emp-wf-pill--purple' },
  { id: 'data_collection', label: 'Data Collection', dot: '#0d9488', pill: 'emp-wf-pill--teal' },
  { id: 'review', label: 'Review', dot: '#ea580c', pill: 'emp-wf-pill--orange' },
]

/** @deprecated use getKanbanColumnsForView */
export const KANBAN_COLUMNS = LAYOUT_KANBAN_COLUMNS

export function getKanbanColumnsForView(viewTab) {
  if (viewTab === 'symbol') return SIMPLE_VIEW_COLUMNS
  if (viewTab === 'schematic' || viewTab === 'style') return SCHEMATIC_KANBAN_COLUMNS
  return LAYOUT_KANBAN_COLUMNS
}

export function defaultViewWorkflow() {
  return {
    style: { status: 'not_started' },
    symbol: { status: 'not_started' },
    schematic: { stage: 'design', status: 'not_started', pendingReview: false },
    layout: { stage: 'floor_plan', status: 'not_started', pendingReview: null },
  }
}

export function normalizeWorkflow(raw) {
  if (!raw || typeof raw !== 'object') return defaultViewWorkflow()
  const layout = raw.layout || {}
  const schematic = raw.schematic || {}
  const legacyStyleStatus = raw.style?.status
  const schematicStage = SCHEMATIC_PIPELINE_STAGES.includes(schematic.stage)
    ? schematic.stage
    : legacyStyleStatus
      ? 'design'
      : 'design'
  return {
    style: { status: raw.style?.status || 'not_started' },
    symbol: { status: raw.symbol?.status || 'not_started' },
    schematic: {
      stage: schematicStage,
      status: schematic.status || legacyStyleStatus || 'not_started',
      pendingReview: Boolean(schematic.pendingReview),
    },
    layout: {
      stage: LAYOUT_STAGES.includes(layout.stage) ? layout.stage : 'floor_plan',
      status: layout.status || 'not_started',
      pendingReview: layout.pendingReview === 'r1' || layout.pendingReview === 'r2' ? layout.pendingReview : null,
    },
  }
}

function getSchematicKanbanColumn(cell) {
  const wf = normalizeSchematicWorkflow(cell?.schematicWorkflow)
  const reviewStatus = wf.find((s) => s.stageKey === 'schematic_review')?.status
  if (reviewStatus === 'pending_review' || reviewStatus === 'approved' || reviewStatus === 'rejected') {
    return 'review'
  }
  for (const key of ['design', 'simulation', 'data_collection']) {
    const stage = wf.find((s) => s.stageKey === key)
    if (stage && stage.status !== 'completed') return key
  }
  return 'review'
}

/** Cell appears in the column matching its current layout stage only */
export function getLayoutKanbanColumn(cell) {
  const wf = normalizeWorkflow(cell?.viewWorkflow)
  return wf.layout.stage
}

export function getCellKanbanColumn(cell, viewTab = 'layout') {
  if (viewTab === 'schematic' || viewTab === 'style') return getSchematicKanbanColumn(cell)
  const wf = normalizeWorkflow(cell?.viewWorkflow)
  if (viewTab === 'symbol') return wf.symbol.status
  return getLayoutKanbanColumn(cell)
}

export function getViewProgressStatus(cell, viewTab = 'layout') {
  const wf = normalizeWorkflow(cell?.viewWorkflow)
  if (viewTab === 'schematic' || viewTab === 'style') return wf.schematic.status
  if (viewTab === 'symbol') return wf.symbol.status
  return wf.layout.status
}

const SIMPLE_STATUS_ORDER = ['not_started', 'in_progress', 'completed']

const REVIEW_LAYOUT_STAGES = new Set(['drc_r1', 'lvs_r2'])

function isLayoutReviewStage(stage) {
  return REVIEW_LAYOUT_STAGES.has(stage)
}

function schematicStageToViewStatus(status) {
  if (status === 'completed' || status === 'approved') return 'completed'
  if (status === 'in_progress' || status === 'pending_review') return 'in_progress'
  return 'not_started'
}

function schematicPipelineColumnStatus(cell, columnId) {
  const wf = normalizeSchematicWorkflow(cell?.schematicWorkflow)
  const currentColumn = getSchematicKanbanColumn(cell)
  const currentIndex = SCHEMATIC_PIPELINE_STAGES.indexOf(currentColumn)
  const columnIndex = SCHEMATIC_PIPELINE_STAGES.indexOf(columnId)
  if (columnIndex < 0) return 'not_started'
  if (columnIndex < currentIndex) return 'completed'
  if (columnIndex > currentIndex) return 'not_started'

  if (columnId === 'review') {
    const review = wf.find((s) => s.stageKey === 'schematic_review')
    if (review?.status === 'approved') return 'completed'
    if (review?.status === 'pending_review') return 'in_progress'
    return 'not_started'
  }

  const stage = wf.find((s) => s.stageKey === columnId)
  return schematicStageToViewStatus(stage?.status || 'not_started')
}

/** Review stages count as completed only after admin approval */
function currentReviewStageStatus(layout, stageId) {
  if (layout.pendingReview) return 'in_progress'
  if (layout.status === 'completed') {
    return stageId === 'lvs_r2' ? 'completed' : 'in_progress'
  }
  return layout.status
}

/** Per-column status for single-cell pipeline boards */
export function getPipelineColumnStatus(cell, columnId, viewTab = 'layout') {
  if (viewTab === 'schematic' || viewTab === 'style') {
    return schematicPipelineColumnStatus(cell, columnId)
  }

  if (viewTab === 'symbol') {
    const currentStatus = getViewProgressStatus(cell, viewTab)
    const currentIndex = SIMPLE_STATUS_ORDER.indexOf(currentStatus)
    const columnIndex = SIMPLE_STATUS_ORDER.indexOf(columnId)
    if (columnIndex < 0) return 'not_started'
    if (columnIndex < currentIndex) return 'completed'
    if (columnIndex > currentIndex) return 'not_started'
    return currentStatus
  }

  const wf = normalizeWorkflow(cell?.viewWorkflow)
  const { layout } = wf
  const currentIndex = LAYOUT_STAGES.indexOf(layout.stage)
  const columnIndex = LAYOUT_STAGES.indexOf(columnId)
  if (columnIndex < 0) return 'not_started'
  if (columnIndex > currentIndex) return 'not_started'

  if (columnIndex < currentIndex) {
    return 'completed'
  }

  if (isLayoutReviewStage(columnId)) {
    return currentReviewStageStatus(layout, columnId)
  }

  return layout.status
}

export function isFinalLayoutStage(cell) {
  const wf = normalizeWorkflow(cell?.viewWorkflow)
  return wf?.layout?.stage === 'lvs_r2'
}

export function actionRequiresChecklist(cell, payload) {
  if (!payload || !cell) return false
  const wf = normalizeWorkflow(cell.viewWorkflow)

  if (payload.type === 'review') {
    return wf.layout.stage === 'lvs_r2'
  }

  if (payload.view !== 'layout') return false

  if (payload.action === 'set_status' && payload.status === 'completed') {
    return wf.layout.stage === 'lvs_r2'
  }

  return false
}

export function getAdvancePayload(cell, viewTab = 'layout') {
  const wf = normalizeWorkflow(cell?.viewWorkflow)

  if (viewTab === 'symbol') {
    if (wf.symbol.status === 'not_started') return { view: 'symbol', action: 'set_status', status: 'in_progress' }
    if (wf.symbol.status === 'in_progress') return { view: 'symbol', action: 'set_status', status: 'completed' }
    return null
  }

  if (viewTab === 'schematic' || viewTab === 'style') {
    const pipeline = normalizeSchematicWorkflow(cell?.schematicWorkflow)
    const active = pipeline.find((stage) =>
      !isSchematicReviewStageKey(stage.stageKey)
      && (stage.status === 'not_started' || stage.status === 'in_progress'),
    )
    if (!active) return null
    if (active.status === 'not_started') {
      return { type: 'schematic', stageKey: active.stageKey, status: 'in_progress' }
    }
    if (active.status === 'in_progress') {
      return { type: 'schematic', stageKey: active.stageKey, status: 'completed' }
    }
    return null
  }

  const { layout } = wf
  if (layout.pendingReview) return null

  if (layout.status === 'not_started') {
    return { view: 'layout', action: 'set_status', status: 'in_progress' }
  }
  if (layout.status === 'in_progress') {
    return { view: 'layout', action: 'set_status', status: 'completed' }
  }

  // R1 at drc_r1, R2 at lvs_r2 — must request review before advancing
  if (layout.stage === 'drc_r1' || layout.stage === 'lvs_r2') {
    return { type: 'review' }
  }

  // floor_plan → drc_r1 → routing → drc → lvs_r2
  if (layout.status === 'completed') {
    return { view: 'layout', action: 'advance_stage' }
  }

  return null
}

export function schematicStageButtonLabel(cell) {
  const pipeline = normalizeSchematicWorkflow(cell?.schematicWorkflow)
  const review = pipeline.find((s) => s.stageKey === 'schematic_review')
  if (review?.status === 'pending_review') return 'Awaiting review'
  if (review?.status === 'approved') return 'Schematic complete'
  const advance = getAdvancePayload(cell, 'schematic')
  if (!advance) return 'Schematic complete'
  if (advance.status === 'in_progress') return 'Start stage'
  if (advance.status === 'completed') {
    const label = SCHEMATIC_STAGE_LABELS[advance.stageKey] || advance.stageKey
    return `Complete ${label}`
  }
  return 'Advance Stage'
}

export function layoutStageButtonLabel(cell) {
  const wf = normalizeWorkflow(cell?.viewWorkflow)
  const { layout } = wf
  if (layout.pendingReview) return `Awaiting ${layout.pendingReview.toUpperCase()} review`
  if (layout.stage === 'lvs_r2' && layout.status === 'completed') return 'Layout complete'
  const advance = getAdvancePayload(cell, 'layout')
  if (!advance) return 'Layout complete'
  if (advance.type === 'review') return 'Request Review'
  if (advance.action === 'set_status' && advance.status === 'in_progress') return 'Start stage'
  if (advance.action === 'set_status' && advance.status === 'completed') return 'Complete stage'
  if (advance.action === 'advance_stage') {
    const idx = LAYOUT_STAGES.indexOf(layout.stage)
    const next = LAYOUT_STAGES[idx + 1]
    return next ? `Advance to ${LAYOUT_STAGE_LABELS[next]}` : 'Advance Stage'
  }
  return 'Advance Stage'
}

export function complexityTag(complexity) {
  if (!complexity) return 'MEDIUM'
  const raw = String(complexity).trim().toLowerCase()
  if (raw === 'simple' || raw === 'low') return 'SIMPLE'
  if (raw === 'hard' || raw === 'high') return 'HARD'
  if (raw === 'critical') return 'CRITICAL'
  if (raw === 'medium') return 'MEDIUM'
  return String(complexity).toUpperCase()
}
