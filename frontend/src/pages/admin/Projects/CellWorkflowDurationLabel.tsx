import { useEffect, useMemo, useState } from 'react'
import { Clock } from 'lucide-react'
import type { CellStatus, CellWorkflowDuration } from '@/types/projectWorkspace'
import { formatWorkflowDurationFromMs } from '@/utils/durationFormat'

type CellWorkflowDurationLabelProps = {
  cellStatus: CellStatus
  workflowDuration?: CellWorkflowDuration | null
  fetchedAt?: number
  className?: string
}

const LIVE_TICK_MS = 30_000

export function CellWorkflowDurationLabel({
  cellStatus,
  workflowDuration,
  fetchedAt,
  className,
}: CellWorkflowDurationLabelProps) {
  const [now, setNow] = useState(() => Date.now())
  const isCompleted = cellStatus === 'completed'
  const shouldTickLive = !isCompleted && Boolean(workflowDuration?.isActive)

  useEffect(() => {
    if (!shouldTickLive) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), LIVE_TICK_MS)
    return () => window.clearInterval(timer)
  }, [shouldTickLive])

  const display = useMemo(() => {
    if (!workflowDuration) return null

    const baseMs = workflowDuration.totalMs ?? 0
    const anchor = fetchedAt ?? Date.now()
    const liveMs = shouldTickLive ? baseMs + Math.max(0, now - anchor) : baseMs
    const formatted = formatWorkflowDurationFromMs(liveMs)

    if (liveMs <= 0 && !shouldTickLive) return null

    const prefix = isCompleted ? 'Total Effort:' : 'Worked So Far:'
    return { prefix, formatted, liveMs }
  }, [workflowDuration, shouldTickLive, isCompleted, now, fetchedAt])

  if (!display) return null

  const title = `${display.prefix} ${display.formatted}`

  return (
    <span className={className ?? 'admin-projects-cell-workflow-duration'} title={title}>
      <Clock className="admin-projects-cell-workflow-duration-icon" aria-hidden />
      <span>
        {display.prefix} {display.formatted}
      </span>
    </span>
  )
}
