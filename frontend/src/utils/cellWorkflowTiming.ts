import type {
  CellWorkflowStageKey,
  CellWorkflowTiming,
  StageWorkflowTiming,
  WorkflowStageStatus,
} from '@/types/projectWorkspace'

export function getStageTiming(
  timing: CellWorkflowTiming | null | undefined,
  stageKey: CellWorkflowStageKey,
): StageWorkflowTiming | null {
  if (!timing?.stages?.length) return null
  return timing.stages.find((stage) => stage.stageKey === stageKey) ?? null
}

export function isStageCompleteStatus(status: WorkflowStageStatus): boolean {
  return status === 'completed' || status === 'approved'
}

export function hasStageTimingContent(
  timing: StageWorkflowTiming | null | undefined,
  status: WorkflowStageStatus,
): boolean {
  if (!timing) return false
  if (timing.isActive || timing.totalMs > 0) return true
  if (isStageCompleteStatus(status) && timing.stageCompletionTime) return true
  return Boolean(
    timing.checkInTime
    || timing.checkOutTime
    || timing.stageStartTime
    || timing.latestActivityTime,
  )
}
