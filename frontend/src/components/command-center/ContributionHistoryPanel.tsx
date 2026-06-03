import {
  formatProjectMembers,
  type ProjectContributionStatus,
  type ProjectTableRow,
} from '@/pages/admin/Dashboard/dashboardChartUtils'
import { cn } from '@/utils/cn'

const STATUS_LEGEND: {
  status: ProjectContributionStatus
  label: string
  dotClass: string
  labelClass: string
}[] = [
  {
    status: 'In Progress',
    label: 'In progress',
    dotClass: 'dashboard-contribution-dot--progress',
    labelClass: 'dashboard-contribution-legend-label--progress',
  },
  {
    status: 'Completed',
    label: 'Completed',
    dotClass: 'dashboard-contribution-dot--completed',
    labelClass: 'dashboard-contribution-legend-label--completed',
  },
  {
    status: 'Cancelled',
    label: 'Cancelled',
    dotClass: 'dashboard-contribution-dot--cancelled',
    labelClass: 'dashboard-contribution-legend-label--cancelled',
  },
]

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

function ContributionStatusDot({ status }: { status: ProjectContributionStatus }) {
  return (
    <span
      className={cn('dashboard-contribution-dot', statusDotClass(status))}
      title={status}
      aria-label={status}
      role="img"
    />
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
        <div className="dashboard-contribution-legend" aria-label="Project status legend">
          {STATUS_LEGEND.map((item) => (
            <span key={item.status} className="dashboard-contribution-legend-item">
              <span className={cn('dashboard-contribution-dot', item.dotClass)} aria-hidden />
              <span className={cn('dashboard-contribution-legend-label', item.labelClass)}>
                {item.label}
              </span>
            </span>
          ))}
        </div>
      </header>
      <div className="dashboard-contribution-table-wrap min-h-0 flex-1 overflow-auto pb-4">
        <table className="dashboard-contribution-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Client</th>
              <th>Lead</th>
              <th>Members</th>
              <th className="dashboard-contribution-status-col">Status</th>
              <th className="text-right">Total Hours</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={`contrib-skeleton-${i}`}>
                  <td colSpan={6}>
                    <div className="h-9 rounded-lg bg-slate-100 skeleton" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="dashboard-contribution-empty">
                  No contribution data for this period.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id} className={index % 2 === 0 ? 'dashboard-contribution-row-even' : ''}>
                  <td className="dashboard-contribution-project">{row.project}</td>
                  <td className="dashboard-contribution-muted">{row.client}</td>
                  <td className="dashboard-contribution-muted">{row.lead}</td>
                  <td className="dashboard-contribution-members" title={row.members.join(', ')}>
                    {formatProjectMembers(row.members)}
                  </td>
                  <td className="dashboard-contribution-status-col">
                    <ContributionStatusDot status={row.status} />
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
