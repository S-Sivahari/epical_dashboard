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

export function CellWorkflowDurationLabel({
  cellStatus,
  workflowDuration,
  fetchedAt,
  className,
}: CellWorkflowDurationLabelProps) {
  const [now, setNow] = useState(() => Date.now())
  const isCompleted = cellStatus === 'completed'
  const isActive = Boolean(workflowDuration?.isActive) && !isCompleted

  useEffect(() => {
    if (!isActive) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [isActive])

  const label = useMemo(() => {
    if (!workflowDuration) return null
    const baseMs = workflowDuration.totalMs ?? 0
    const anchor = fetchedAt ?? Date.now()
    const liveMs = isActive ? baseMs + Math.max(0, now - anchor) : baseMs
    const formatted = formatWorkflowDurationFromMs(liveMs)

    if (isCompleted) {
      if (liveMs <= 0) return null
      return formatted
    }

    if (liveMs <= 0 && !isActive) return null
    return `In Progress • ${formatted} logged`
  }, [workflowDuration, isActive, isCompleted, now, fetchedAt])

  if (!label) return null

  const title = isCompleted ? `Completed in ${label}` : label

  return (
    <span className={className ?? 'admin-projects-cell-workflow-duration'} title={title}>
      <Clock className="admin-projects-cell-workflow-duration-icon" aria-hidden />
      <span>{label}</span>
    </span>
  )
}
