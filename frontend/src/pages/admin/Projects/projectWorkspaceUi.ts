import {
  CELL_WORKFLOW_STAGES,
  type CellWorkflowStage,
  type CellStatus,
  type ProjectCell,
  type WorkflowStageStatus,
} from '@/types/projectWorkspace'

export const STATUS_LABELS: Record<CellStatus, string> = {
  ready: 'In Progress',
  in_progress: 'In Progress',
  completed: 'Complete',
}

/** Status values shown in workspace filters (no Ready). */
export const CELL_STATUS_FILTER_OPTIONS: CellStatus[] = ['in_progress', 'completed']

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStageStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
}

export function defaultCellWorkflow(): CellWorkflowStage[] {
  return CELL_WORKFLOW_STAGES.map((stage) => ({
    stageKey: stage.key,
    stageLabel: stage.label,
    status: 'not_started',
  }))
}

export function normalizeCellWorkflow(workflow?: CellWorkflowStage[]): CellWorkflowStage[] {
  const defaults = defaultCellWorkflow()
  if (!workflow?.length) return defaults
  const byKey = new Map(workflow.map((stage) => [stage.stageKey, stage]))
  return defaults.map((stage) => {
    const stored = byKey.get(stage.stageKey)
    return stored ? { ...stored, stageLabel: stage.stageLabel } : stage
  })
}

export function cellDisplayStatus(cell: ProjectCell) {
  if (cell.isBlocked && cell.status !== 'completed') return 'Archive'
  return STATUS_LABELS[cell.status]
}

export function workflowProgressPercent(cell: ProjectCell) {
  const workflow = normalizeCellWorkflow(cell.workflow)
  const total = workflow.length || cell.workflowTotalStages || CELL_WORKFLOW_STAGES.length
  const completed = workflow.filter((s) => s.status === 'completed').length
  return total > 0 ? Math.round((completed / total) * 100) : 0
}

export function workflowStageStatusClass(status: WorkflowStageStatus) {
  if (status === 'completed') return 'is-completed'
  if (status === 'in_progress') return 'is-progress'
  return 'is-not-started'
}

export function normalizeViewStatus(value?: string): WorkflowStageStatus {
  if (value === 'in_progress' || value === 'completed') return value
  return 'not_started'
}
