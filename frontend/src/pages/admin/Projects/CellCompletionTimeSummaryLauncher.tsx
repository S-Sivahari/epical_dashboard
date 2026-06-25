import { useState } from 'react'
import type { ProjectCell } from '@/types/projectWorkspace'
import { CellWorkflowDurationLabel } from './CellWorkflowDurationLabel'
import { CellCompletionTimeSummaryModal } from './CellCompletionTimeSummaryModal'

type CellCompletionTimeSummaryLauncherProps = {
  cell: ProjectCell
  fetchedAt?: number
  className?: string
  variant?: 'default' | 'header'
  alwaysVisible?: boolean
  onHold?: boolean
  holdEnabled?: boolean
  onHoldToggle?: (hold: boolean) => void
}

export function CellCompletionTimeSummaryLauncher({
  cell,
  fetchedAt: fetchedAtProp,
  className,
  variant,
  alwaysVisible,
  onHold,
  holdEnabled,
  onHoldToggle,
}: CellCompletionTimeSummaryLauncherProps) {
  const [open, setOpen] = useState(false)
  const [anchorTime] = useState(() => Date.now())
  const fetchedAt = fetchedAtProp ?? anchorTime
  const canOpenSummary = cell.status === 'completed' || cell.status === 'in_progress'
  const duration = cell.productiveWorkDuration ?? cell.workflowDuration

  return (
    <>
      <CellWorkflowDurationLabel
        cellStatus={cell.status}
        workflowDuration={duration}
        fetchedAt={fetchedAt}
        className={className}
        variant={variant}
        alwaysVisible={alwaysVisible}
        onHold={onHold}
        holdEnabled={holdEnabled}
        onHoldToggle={onHoldToggle}
        onSummaryClick={canOpenSummary ? () => setOpen(true) : undefined}
      />
      <CellCompletionTimeSummaryModal
        cell={cell}
        isOpen={open}
        onClose={() => setOpen(false)}
        fetchedAt={fetchedAt}
      />
    </>
  )
}
