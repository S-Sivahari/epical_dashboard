import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock3 } from 'lucide-react'
import {
  buildEffortEstimationRows,
  buildEffortEstimationSummary,
  formatHours,
  formatVariance,
} from './employeeEffortEstimationUtils'

function SummaryCard({ label, value, subtext, valueTone }) {
  return (
    <div className="emp-wf-effort-summary-card">
      <span className="emp-wf-effort-summary-card-label">{label}</span>
      <strong className={`emp-wf-effort-summary-card-value${valueTone ? ` is-${valueTone}` : ''}`}>
        {value}
      </strong>
      {subtext ? <span className="emp-wf-effort-summary-card-sub">{subtext}</span> : null}
    </div>
  )
}

export function EmployeeProjectEffortPanel({ cells = [], projectId }) {
  const navigate = useNavigate()

  const rows = useMemo(() => buildEffortEstimationRows(cells), [cells])
  const summary = useMemo(() => buildEffortEstimationSummary(cells), [cells])

  const openCellLog = (cellId) => {
    if (!projectId) return
    navigate(`/employee/projects/${projectId}/cells/${cellId}`)
  }

  return (
    <div className="emp-wf-effort-estimation">
      <h2 className="emp-wf-effort-estimation-title">Effort Estimation</h2>

      {cells.length === 0 ? (
        <p className="emp-wf-status">No cells assigned to you in this project yet.</p>
      ) : (
        <>
          <div className="emp-wf-effort-summary-grid">
            <SummaryCard label="Total estimated" value={formatHours(summary.totalEstimated)} />
            <SummaryCard label="Total actual" value={formatHours(summary.totalActual)} />
            <SummaryCard
              label="Variance"
              value={formatVariance(summary.variance)}
              valueTone={summary.varianceTone}
            />
            <SummaryCard
              label="% complete"
              value={`${summary.percentComplete}%`}
              subtext={`${summary.completed} of ${summary.total} blocks`}
            />
          </div>

          <div className="emp-wf-effort-table-wrap">
            <table className="emp-wf-effort-table">
              <thead>
                <tr>
                  <th>Block</th>
                  <th>Complexity</th>
                  <th>Base</th>
                  <th>Factor</th>
                  <th>Est.</th>
                  <th>Smart est.</th>
                  <th>Actual</th>
                  <th>Variance</th>
                  <th>Log</th>
                  <th>Prediction insight</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        type="button"
                        className="emp-wf-effort-block-link"
                        onClick={() => openCellLog(row.id)}
                      >
                        {row.name}
                      </button>
                    </td>
                    <td>
                      <span
                        className={`emp-wf-effort-complexity emp-wf-effort-complexity--${row.complexityTone}`}
                      >
                        {row.complexityLabel}
                      </span>
                    </td>
                    <td>{formatHours(row.base)}</td>
                    <td>{row.factorLabel}</td>
                    <td>{formatHours(row.estimated)}</td>
                    <td>{formatHours(row.smartEst)}</td>
                    <td>{formatHours(row.actual)}</td>
                    <td>
                      <span className={`emp-wf-effort-variance is-${row.varianceTone}`}>
                        {formatVariance(row.variance)}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="emp-wf-effort-log-btn"
                        onClick={() => openCellLog(row.id)}
                        aria-label={`Open log for ${row.name}`}
                      >
                        <Clock3 className="h-4 w-4" aria-hidden />
                      </button>
                    </td>
                    <td>
                      <span className="emp-wf-effort-insight">{row.insight}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
