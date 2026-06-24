import { useEffect, useMemo, useState } from 'react'
import type { StageWorkflowTiming, WorkflowStageStatus } from '@/types/projectWorkspace'
import { formatDateTime } from '@/utils/formatDate'
import { formatWorkflowDurationFromMs } from '@/utils/durationFormat'
import {
  hasStageTimingContent,
  isStageCompleteStatus,
} from '@/utils/cellWorkflowTiming'

type CellWorkflowStageTimingMetaProps = {
  timing?: StageWorkflowTiming | null
  status: WorkflowStageStatus
  compact?: boolean
  fetchedAt?: number
}

const LIVE_TICK_MS = 1_000

function TimestampRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="admin-projects-workflow-stage-timing-row">
      <dt>{label}</dt>
      <dd>
        <time dateTime={value}>{formatDateTime(value)}</time>
      </dd>
    </div>
  )
}

export function CellWorkflowStageTimingMeta({
  timing,
  status,
  compact = false,
  fetchedAt,
}: CellWorkflowStageTimingMetaProps) {
  const isActive = Boolean(timing?.isActive)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!isActive) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), LIVE_TICK_MS)
    return () => window.clearInterval(timer)
  }, [isActive])

  const displayTotal = useMemo(() => {
    const baseMs = timing?.totalMs ?? 0
    if (!isActive) return timing?.formattedTotal ?? formatWorkflowDurationFromMs(baseMs)
    const anchor = fetchedAt ?? Date.now()
    const liveMs = baseMs + Math.max(0, now - anchor)
    return formatWorkflowDurationFromMs(liveMs)
  }, [timing?.totalMs, timing?.formattedTotal, isActive, fetchedAt, now])

  if (!hasStageTimingContent(timing, status)) return null

  const isComplete = isStageCompleteStatus(status)
  const durationLabel = isActive ? 'Worked so far' : 'Time spent'

  return (
    <dl
      className={compact
        ? 'admin-projects-workflow-stage-timing admin-projects-workflow-stage-timing--compact'
        : 'admin-projects-workflow-stage-timing'}
    >
      {isActive && timing?.checkInTime ? (
        <TimestampRow label="Check-in" value={timing.checkInTime} />
      ) : null}
      {!isActive && timing?.checkOutTime ? (
        <TimestampRow label="Check-out" value={timing.checkOutTime} />
      ) : null}
      {timing?.stageStartTime ? (
        <TimestampRow label="Stage start" value={timing.stageStartTime} />
      ) : null}
      {isComplete && timing?.stageCompletionTime ? (
        <TimestampRow label="Completed" value={timing.stageCompletionTime} />
      ) : null}
      {timing?.latestActivityTime ? (
        <TimestampRow label="Latest activity" value={timing.latestActivityTime} />
      ) : null}
      {(isActive || (timing?.totalMs ?? 0) > 0) && displayTotal ? (
        <div className="admin-projects-workflow-stage-timing-row admin-projects-workflow-stage-timing-row--duration">
          <dt>{durationLabel}</dt>
          <dd>{displayTotal}</dd>
        </div>
      ) : null}
    </dl>
  )
}
