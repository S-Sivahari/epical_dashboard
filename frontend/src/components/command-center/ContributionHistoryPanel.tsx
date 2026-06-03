import {
  formatProjectAccessLabel,
  type ProjectContributionStatus,
  type ProjectTableRow,
} from '@/pages/admin/Dashboard/dashboardChartUtils'
import { cn } from '@/utils/cn'

function statusDotClass(status: ProjectContributionStatus): string {
  switch (status) {
    case 'Completed':
      return 'dashboard-contribution-dot--completed'
    case 'Cancelled':
      return 'dashboard-contribution-dot--cancelled'
    default:
      return 'dashboard-contribution-dot--progress'
  }
}

function statusLabelClass(status: ProjectContributionStatus): string {
  switch (status) {
    case 'Completed':
      return 'dashboard-contribution-status-label--completed'
    case 'Cancelled':
      return 'dashboard-contribution-status-label--cancelled'
    default:
      return 'dashboard-contribution-status-label--progress'
  }
}

function statusLabel(status: ProjectContributionStatus): string {
  switch (status) {
    case 'Completed':
      return 'Completed'
    case 'Cancelled':
      return 'Cancelled'
    default:
      return 'In progress'
  }
}

function ContributionStatusCell({ status }: { status: ProjectContributionStatus }) {
  const label = statusLabel(status)
  return (
    <span className="dashboard-contribution-status-cell">
      <span
        className={cn('dashboard-contribution-dot', statusDotClass(status))}
        aria-hidden
      />
      <span className={cn('dashboard-contribution-status-label', statusLabelClass(status))}>
        {label}
      </span>
    </span>
  )
}

export function ContributionHistoryPanel({
  loading,
  rows,
  className,
}: {
  loading: boolean
  rows: ProjectTableRow[]
  className?: string
}) {
  return (
    <section className={cn('dashboard-panel dashboard-contribution-history', className)}>
      <header className="dashboard-panel-header dashboard-panel-header--primary dashboard-panel-header-compact dashboard-contribution-header">
        <div className="min-w-0">
          <h2 className="dashboard-panel-title">Contribution History</h2>
          <p className="dashboard-panel-subtitle">Hours logged by project for the selected period</p>
        </div>
      </header>
      <div className="dashboard-contribution-table-wrap min-h-0 flex-1 overflow-auto pb-4">
        <table className="dashboard-contribution-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Client</th>
              <th>Access</th>
              <th className="dashboard-contribution-status-col">Status</th>
              <th className="text-right">Total Hours</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={`contrib-skeleton-${i}`}>
                  <td colSpan={5}>
                    <div className="h-9 rounded-lg bg-slate-100 skeleton" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="dashboard-contribution-empty">
                  No contribution data for this period.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id} className={index % 2 === 0 ? 'dashboard-contribution-row-even' : ''}>
                  <td className="dashboard-contribution-project">{row.project}</td>
                  <td className="dashboard-contribution-muted">{row.client}</td>
                  <td
                    className={cn(
                      'dashboard-contribution-access',
                      row.access === 'private'
                        ? 'dashboard-contribution-access--private'
                        : 'dashboard-contribution-access--public',
                    )}
                  >
                    {formatProjectAccessLabel(row.access)}
                  </td>
                  <td className="dashboard-contribution-status-col">
                    <ContributionStatusCell status={row.status} />
                  </td>
                  <td className="dashboard-contribution-hours">{row.totalHours}h</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
