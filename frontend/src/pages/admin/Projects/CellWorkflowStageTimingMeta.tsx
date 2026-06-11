import type { StageWorkflowTiming, WorkflowStageStatus } from '@/types/projectWorkspace'
import { formatDateTime } from '@/utils/formatDate'
import {
  hasStageTimingContent,
  isStageCompleteStatus,
} from '@/utils/cellWorkflowTiming'

type CellWorkflowStageTimingMetaProps = {
  timing?: StageWorkflowTiming | null
  status: WorkflowStageStatus
  compact?: boolean
}

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
}: CellWorkflowStageTimingMetaProps) {
  if (!hasStageTimingContent(timing, status)) return null

  const isActive = Boolean(timing?.isActive)
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
      {(isActive || (timing?.totalMs ?? 0) > 0) && timing?.formattedTotal ? (
        <div className="admin-projects-workflow-stage-timing-row admin-projects-workflow-stage-timing-row--duration">
          <dt>{durationLabel}</dt>
          <dd>{timing.formattedTotal}</dd>
        </div>
      ) : null}
    </dl>
  )
}
