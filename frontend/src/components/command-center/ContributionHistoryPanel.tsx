import { SkeletonBlock } from './shared'
import type { ProjectTableRow } from '@/pages/admin/Dashboard/dashboardChartUtils'
import { cn } from '@/utils/cn'

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
      <header className="dashboard-panel-header dashboard-panel-header-compact">
        <div>
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
              <th>Lead</th>
              <th className="text-right">Total Hours</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={`contrib-skeleton-${i}`}>
                  <td colSpan={4}>
                    <div className="h-9 rounded-lg bg-slate-100 skeleton" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="dashboard-contribution-empty">
                  No contribution data for this period.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id} className={index % 2 === 0 ? 'dashboard-contribution-row-even' : ''}>
                  <td className="font-semibold text-[#1f5516]">{row.project}</td>
                  <td>{row.client}</td>
                  <td>{row.lead}</td>
                  <td className="text-right font-semibold tabular-nums text-[#266b1c]">{row.totalHours}h</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
