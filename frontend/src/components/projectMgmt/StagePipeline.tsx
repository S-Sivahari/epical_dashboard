import { CheckCircle2, Eye, Train } from 'lucide-react'
import type { CellStage, CellStageStatus } from '@/services/projectMgmtService'
import { CELL_STAGES } from './stageConstants'
import { cn } from '@/utils/cn'

interface StagePipelineProps {
  currentStage: CellStage
  stageStatus: CellStageStatus
  compact?: boolean
}

export function StagePipeline({ currentStage, stageStatus, compact = false }: StagePipelineProps) {
  const currentIdx = CELL_STAGES.findIndex((s) => s.key === currentStage)

  return (
    <div className="relative">
      {!compact && (
        <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
          <Train className="h-3.5 w-3.5" />
          Layout Pipeline
        </div>
      )}

      <div className="overflow-x-auto pb-1">
        <div className={cn('flex items-start', compact ? 'min-w-[420px]' : 'min-w-[640px]')}>
          {CELL_STAGES.map((stage, idx) => {
            const isCompleted = idx < currentIdx || (idx === currentIdx && stageStatus === 'approved')
            const isCurrent = idx === currentIdx && stageStatus !== 'approved'
            const isFuture = idx > currentIdx

            return (
              <div key={stage.key} className="flex flex-1 items-start">
                <div className="flex flex-1 flex-col items-center">
                  <div
                    className={cn(
                      'relative flex items-center justify-center rounded-full border-2 font-bold transition-all',
                      compact ? 'h-8 w-8 text-[10px]' : 'h-11 w-11 text-xs',
                      isCompleted && 'border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30',
                      isCurrent && stageStatus === 'for_review' &&
                        'border-amber-500 bg-amber-500 text-white ring-4 ring-amber-200/60 shadow-sm shadow-amber-500/30',
                      isCurrent && stageStatus !== 'for_review' &&
                        'border-primary bg-primary text-white ring-4 ring-primary/20 shadow-sm shadow-primary/30',
                      isFuture && 'border-slate-200 bg-white text-slate-400'
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
                    ) : isCurrent && stageStatus === 'for_review' ? (
                      <Eye className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>

                  <span
                    className={cn(
                      'mt-2 text-center font-semibold leading-tight',
                      compact ? 'text-[10px]' : 'text-xs',
                      isCompleted && 'text-emerald-600',
                      isCurrent && 'text-primary',
                      isFuture && 'text-slate-400'
                    )}
                  >
                    {stage.label}
                  </span>

                  {stage.isReview && (
                    <span
                      className={cn(
                        'mt-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                        isCurrent && stageStatus === 'for_review' && 'bg-amber-100 text-amber-700',
                        isCurrent && stageStatus === 'in_progress' && 'bg-blue-100 text-blue-600',
                        isCompleted && 'bg-emerald-100 text-emerald-600',
                        isFuture && 'bg-slate-100 text-slate-400'
                      )}
                    >
                      {isCurrent && stageStatus === 'for_review'
                        ? 'Review'
                        : stage.isReview
                          ? 'Gate'
                          : ''}
                    </span>
                  )}
                </div>

                {idx < CELL_STAGES.length - 1 && (
                  <div className="flex flex-1 items-center pt-4">
                    <div
                      className={cn(
                        'h-1 w-full rounded-full transition-colors',
                        idx < currentIdx ? 'bg-emerald-500' : 'bg-slate-200'
                      )}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
