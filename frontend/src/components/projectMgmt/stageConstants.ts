import type { CellStage, CellStageStatus, CellType } from '@/services/projectMgmtService'

export const CELL_STAGES: { key: CellStage; label: string; shortLabel: string; isReview: boolean }[] = [
  { key: 'floor_plan', label: 'Floor Plan', shortLabel: 'FP', isReview: false },
  { key: 'drc_1', label: 'DRC', shortLabel: 'DRC', isReview: true },
  { key: 'routing', label: 'Routing', shortLabel: 'RT', isReview: false },
  { key: 'drc_2', label: 'DRC', shortLabel: 'DRC', isReview: false },
  { key: 'lvs', label: 'LVS', shortLabel: 'LVS', isReview: true },
]

export const CELL_TYPE_COLORS: Record<CellType, string> = {
  Block: 'bg-violet-500/10 text-violet-700 border-violet-200',
  IO: 'bg-amber-500/10 text-amber-700 border-amber-200',
  ESD: 'bg-rose-500/10 text-rose-700 border-rose-200',
  TOP: 'bg-cyan-500/10 text-cyan-700 border-cyan-200',
}

export const STAGE_STATUS_STYLES: Record<CellStageStatus, string> = {
  in_progress: 'bg-blue-500/10 text-blue-700 border-blue-200',
  for_review: 'bg-amber-500/10 text-amber-700 border-amber-200',
  approved: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
}

export const STAGE_STATUS_LABELS: Record<CellStageStatus, string> = {
  in_progress: 'In Progress',
  for_review: 'For Review',
  approved: 'Completed',
}

export function getStageLabel(stage: CellStage): string {
  return CELL_STAGES.find((s) => s.key === stage)?.label ?? stage
}

export function getStageIndex(stage: CellStage): number {
  return CELL_STAGES.findIndex((s) => s.key === stage)
}
