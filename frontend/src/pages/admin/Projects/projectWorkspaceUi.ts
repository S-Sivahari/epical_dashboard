import {
  CELL_WORKFLOW_STAGES,
  REVIEW_STAGE_KEYS,
  type CellType,
  type CellWorkflowStage,
  type CellWorkflowStageKey,
  type CellStatus,
  type ProjectCell,
  type WorkflowStageStatus,
} from '@/types/projectWorkspace'

export const CELL_TYPE_LABELS: Record<CellType, string> = {
  block: 'BLOCK',
  IOP: 'IO',
  ESD: 'ESD',
  TOP: 'TOP',
}

export const STATUS_LABELS: Record<CellStatus, string> = {
  ready: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Complete',
}

/** Status values shown in workspace filters and editable status pickers. */
export const CELL_STATUS_FILTER_OPTIONS: CellStatus[] = ['ready', 'in_progress', 'completed']

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStageStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
}

const LEGACY_STAGE_KEY_MAP: Record<string, CellWorkflowStageKey> = {
  drc_review_1: 'drc_first',
  drc: 'drc_final',
  lvs_review_2: 'lvs',
}

export function isReviewStageKey(stageKey: CellWorkflowStageKey): boolean {
  return (REVIEW_STAGE_KEYS as readonly string[]).includes(stageKey)
}

export function defaultCellWorkflow(): CellWorkflowStage[] {
  return CELL_WORKFLOW_STAGES.map((stage) => ({
    stageKey: stage.key,
    stageLabel: stage.label,
    status: stage.key === 'floor_plan' ? 'in_progress' : 'not_started',
  }))
}

export function normalizeCellWorkflow(workflow?: CellWorkflowStage[]): CellWorkflowStage[] {
  const defaults = defaultCellWorkflow()
  if (!workflow?.length) return defaults

  const byKey = new Map<CellWorkflowStageKey, CellWorkflowStage>()
  for (const stage of workflow) {
    const mappedKey = LEGACY_STAGE_KEY_MAP[stage.stageKey] ?? stage.stageKey
    if (!(CELL_WORKFLOW_STAGES as readonly { key: string }[]).some((s) => s.key === mappedKey)) continue
    const canonical = CELL_WORKFLOW_STAGES.find((s) => s.key === mappedKey)!
    byKey.set(canonical.key, {
      ...stage,
      stageKey: canonical.key,
      stageLabel: canonical.label,
      status: normalizeWorkflowStageStatus(stage.status),
    })
  }

  return defaults.map((stage) => byKey.get(stage.stageKey) || stage)
}

export function normalizeWorkflowStageStatus(value?: string): WorkflowStageStatus {
  if (value && (Object.keys(WORKFLOW_STATUS_LABELS) as WorkflowStageStatus[]).includes(value as WorkflowStageStatus)) {
    return value as WorkflowStageStatus
  }
  return 'not_started'
}

function stageStatus(workflow: CellWorkflowStage[], key: CellWorkflowStageKey): WorkflowStageStatus {
  return workflow.find((s) => s.stageKey === key)?.status ?? 'not_started'
}

function prerequisitesMet(workflow: CellWorkflowStage[], stageKey: CellWorkflowStageKey): boolean {
  const normalized = normalizeCellWorkflow(workflow)
  switch (stageKey) {
    case 'floor_plan':
      return true
    case 'drc_first':
      return stageStatus(normalized, 'floor_plan') === 'completed'
    case 'review_1':
      return stageStatus(normalized, 'drc_first') === 'completed'
    case 'routing':
      return stageStatus(normalized, 'review_1') === 'approved'
    case 'drc_final':
      return stageStatus(normalized, 'routing') === 'completed'
    case 'lvs':
      return stageStatus(normalized, 'drc_final') === 'completed'
    case 'review_2':
      return stageStatus(normalized, 'lvs') === 'completed'
    default:
      return false
  }
}

/** Locked only for stages that have not started yet and lack prerequisites. */
export function isStageLocked(workflow: CellWorkflowStage[], stageKey: CellWorkflowStageKey): boolean {
  const normalized = normalizeCellWorkflow(workflow)
  const stage = normalized.find((s) => s.stageKey === stageKey)
  if (!stage || isReviewStageKey(stageKey)) return false
  if (stage.status !== 'not_started') return false
  return !prerequisitesMet(normalized, stageKey)
}

export function cellDisplayStatus(cell: ProjectCell) {
  return STATUS_LABELS[cell.status]
}

/** Project progress: completed cells / total cells (0–100). */
export function projectCellProgressPercent(completedCells: number, totalCells: number): number {
  if (totalCells <= 0) return 0
  return Math.round((completedCells / totalCells) * 100)
}

/** Per-cell completion progress for workflow tables (100% only when explicitly completed). */
export function cellCompletionProgressPercent(cell: ProjectCell): number {
  return cell.status === 'completed' ? 100 : 0
}

export function workflowProgressPercent(cell: ProjectCell) {
  const workflow = normalizeCellWorkflow(cell.workflow)
  const total = workflow.length || cell.workflowTotalStages || CELL_WORKFLOW_STAGES.length
  const completed = workflow.filter((stage) => {
    if (isReviewStageKey(stage.stageKey)) return stage.status === 'approved'
    return stage.status === 'completed'
  }).length
  return total > 0 ? Math.round((completed / total) * 100) : 0
}

export function workflowStageStatusClass(status: WorkflowStageStatus) {
  if (status === 'completed' || status === 'approved') return 'is-completed'
  if (status === 'in_progress') return 'is-progress'
  if (status === 'pending_review') return 'is-pending-review'
  if (status === 'rejected') return 'is-rejected'
  return 'is-not-started'
}

export function normalizeViewStatus(value?: string): WorkflowStageStatus {
  if (value === 'in_progress' || value === 'completed') return value
  return 'not_started'
}
