import type { CellStage, CellStageStatus } from '@/services/projectMgmtService'
import { CELL_STAGES, getStageIndex } from './stageConstants'
import { cn } from '@/utils/cn'

export function StageMiniBar({
  currentStage,
  stageStatus,
}: {
  currentStage: CellStage
  stageStatus: CellStageStatus
}) {
  const idx = getStageIndex(currentStage)

  return (
    <div className="flex items-center gap-0.5">
      {CELL_STAGES.map((stage, i) => (
        <div
          key={stage.key}
          title={stage.label}
          className={cn(
            'h-2 flex-1 rounded-full',
            stageStatus === 'approved' || i < idx
              ? 'bg-emerald-500'
              : i === idx && stageStatus === 'for_review'
                ? 'bg-amber-500'
                : i === idx
                  ? 'bg-primary'
                  : 'bg-slate-200'
          )}
        />
      ))}
    </div>
  )
}
