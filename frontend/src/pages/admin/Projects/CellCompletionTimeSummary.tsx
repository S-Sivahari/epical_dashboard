import type { ProjectCell } from '@/types/projectWorkspace'
import { formatDateTime } from '@/utils/formatDate'
import { buildCellCompletionTimeSummary } from '@/utils/cellCompletionTimeSummary'

type CellCompletionTimeSummaryProps = {
  cell: ProjectCell
  className?: string
}

function formatHours(value: number) {
  const hours = Math.round(value * 100) / 100
  return `${hours}h`
}

export function CellCompletionTimeSummary({
  cell,
  className,
}: CellCompletionTimeSummaryProps) {
  if (cell.status !== 'completed') return null

  const summary = buildCellCompletionTimeSummary(cell)

  return (
    <section
      className={className ?? 'admin-projects-cell-completion-time'}
      aria-label="Cell completion time summary"
    >
      <div className="admin-projects-cell-completion-time-head">
        <h2>Time summary</h2>
        <p>Productive time, holds, and completion timestamps for this cell.</p>
      </div>

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
          <span className="admin-projects-cell-completion-time-label">Completed</span>
          <strong>
            {summary.completedAt ? (
              <time dateTime={summary.completedAt}>{formatDateTime(summary.completedAt)}</time>
            ) : (
              '—'
            )}
          </strong>
        </div>

        <div className="admin-projects-cell-completion-time-item is-highlight">
          <span className="admin-projects-cell-completion-time-label">Productive time</span>
          <strong>{summary.productiveFormatted}</strong>
        </div>

        <div className="admin-projects-cell-completion-time-item">
          <span className="admin-projects-cell-completion-time-label">Estimated effort</span>
          <strong>{formatHours(summary.estimatedHours)}</strong>
        </div>

        <div className="admin-projects-cell-completion-time-item">
          <span className="admin-projects-cell-completion-time-label">Actual effort</span>
          <strong>{formatHours(summary.actualHours)}</strong>
        </div>

        <div className="admin-projects-cell-completion-time-item">
          <span className="admin-projects-cell-completion-time-label">Total hold time</span>
          <strong>{summary.holdPeriods.length > 0 ? summary.totalHoldFormatted : '—'}</strong>
        </div>
      </div>

      {summary.holdPeriods.length > 0 ? (
        <div className="admin-projects-cell-completion-holds">
          <h3>Hold periods</h3>
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
