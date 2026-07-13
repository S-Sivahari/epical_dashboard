import { useEffect, useMemo, useState } from 'react'
import type { ProjectCell } from '@/types/projectWorkspace'
import { formatDateTime } from '@/utils/formatDate'
import { formatWorkflowDurationFromMs } from '@/utils/durationFormat'
import { buildCellCompletionTimeSummary } from '@/utils/cellCompletionTimeSummary'

type CellCompletionTimeSummaryProps = {
  cell: ProjectCell
  className?: string
  variant?: 'inline' | 'modal'
  fetchedAt?: number
}

function formatHours(value: number) {
  const hours = Math.round(value * 100) / 100
  return `${hours}h`
}

export function CellCompletionTimeSummary({
  cell,
  className,
  variant = 'inline',
  fetchedAt,
}: CellCompletionTimeSummaryProps) {
  const hasTimingData = Boolean(
    cell.workflowTiming
      || cell.productiveWorkDuration
      || cell.workflowDuration
      || cell.status === 'completed'
      || cell.status === 'in_progress',
  )

  if (!hasTimingData) return null

  const summary = buildCellCompletionTimeSummary(cell)
  const isModal = variant === 'modal'
  const isCompleted = cell.status === 'completed'
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!summary.stageBreakdown.some((stage) => stage.isActive)) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [summary.stageBreakdown])

  const stageRows = useMemo(() => {
    const anchor = fetchedAt ?? Date.now()
    return summary.stageBreakdown.map((stage) => {
      if (!stage.isActive) return stage
      const liveMs = stage.totalMs + Math.max(0, now - anchor)
      return {
        ...stage,
        totalMs: liveMs,
        formatted: formatWorkflowDurationFromMs(liveMs),
      }
    })
  }, [summary.stageBreakdown, fetchedAt, now])

  return (
    <section
      className={
        className
          ?? (isModal
            ? 'admin-projects-cell-completion-time admin-projects-cell-completion-time--modal'
            : 'admin-projects-cell-completion-time')
      }
      aria-label="Cell time calculation summary"
    >
      {!isModal ? (
        <div className="admin-projects-cell-completion-time-head">
          <h2>Time Summary</h2>
        </div>
      ) : null}

      <div className="admin-projects-cell-completion-time-grid">
        <div className="admin-projects-cell-completion-time-item">
          <span className="admin-projects-cell-completion-time-label">Started</span>
          <strong>
            {summary.startedAt ? (
              <time dateTime={summary.startedAt}>{formatDateTime(summary.startedAt)}</time>
            ) : (
              '—'
            )}
          </strong>
        </div>

        <div className="admin-projects-cell-completion-time-item">
          <span className="admin-projects-cell-completion-time-label">
            {isCompleted ? 'Completed' : 'Status'}
          </span>
          <strong>
            {summary.completedAt ? (
              <time dateTime={summary.completedAt}>{formatDateTime(summary.completedAt)}</time>
            ) : isCompleted ? (
              '—'
            ) : (
              'In progress'
            )}
          </strong>
        </div>

        <div className="admin-projects-cell-completion-time-item is-highlight">
          <span className="admin-projects-cell-completion-time-label">Productive Time</span>
          <strong>{summary.productiveFormatted}</strong>
        </div>

        <div className="admin-projects-cell-completion-time-item">
          <span className="admin-projects-cell-completion-time-label">Estimated Effort</span>
          <strong>{formatHours(summary.estimatedHours)}</strong>
        </div>

        <div className="admin-projects-cell-completion-time-item">
          <span className="admin-projects-cell-completion-time-label">Actual Effort</span>
          <strong>{formatHours(summary.actualHours)}</strong>
        </div>

        <div className="admin-projects-cell-completion-time-item">
          <span className="admin-projects-cell-completion-time-label">Total Hold Time</span>
          <strong>{summary.holdPeriods.length > 0 ? summary.totalHoldFormatted : '—'}</strong>
        </div>
      </div>

      {stageRows.length > 0 ? (
        <div className="admin-projects-cell-completion-stages">
          <h3>Calculation Breakdown</h3>
          
          <ul className="admin-projects-cell-completion-stages-list">
            {stageRows.map((stage) => (
              <li
                key={stage.stageKey}
                className={`admin-projects-cell-completion-stages-item${stage.isActive ? ' is-active' : ''}`}
              >
                <span className="admin-projects-cell-completion-stages-label">{stage.label}</span>
                <strong>{stage.formatted}</strong>
                {stage.isActive ? (
                  <span className="admin-projects-cell-completion-stages-badge">Live</span>
                ) : null}
              </li>
            ))}
            <li className="admin-projects-cell-completion-stages-item is-total">
              <span className="admin-projects-cell-completion-stages-label">Total productive</span>
              <strong>{summary.productiveFormatted}</strong>
            </li>
          </ul>
        </div>
      ) : null}

      {summary.holdPeriods.length > 0 ? (
        <div className="admin-projects-cell-completion-holds">
          <h3>Hold Periods</h3>
          <ul className="admin-projects-cell-completion-holds-list">
            {summary.holdPeriods.map((period, index) => (
              <li key={`${period.startedAt}-${index}`} className="admin-projects-cell-completion-holds-item">
                <div className="admin-projects-cell-completion-holds-range">
                  <time dateTime={period.startedAt}>{formatDateTime(period.startedAt)}</time>
                  <span aria-hidden>→</span>
                  {period.endedAt ? (
                    <time dateTime={period.endedAt}>{formatDateTime(period.endedAt)}</time>
                  ) : (
                    <span>End of cell</span>
                  )}
                </div>
                <div className="admin-projects-cell-completion-holds-meta">
                  <span>{period.formatted}</span>
                  {period.heldBy ? <span>by {period.heldBy}</span> : null}
                  {period.reason ? <span>{period.reason}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
