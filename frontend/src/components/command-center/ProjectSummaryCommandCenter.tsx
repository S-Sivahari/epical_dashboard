import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ProjectHoursAreaChart } from '@components/charts/ProjectHoursAreaChart'
import { SkeletonBlock } from './shared'
import {
  CHART_PERIODS,
  getChartSubtitle,
  type ChartPeriod,
  type ProjectTableRow,
} from '@/pages/admin/Dashboard/dashboardChartUtils'
import { formatHoursAsDuration } from '@/utils/durationFormat'
import { cn } from '@/utils/cn'

interface ProjectSummaryCommandCenterProps {
  loading: boolean
  chartData: { name: string; hours: number }[]
  chartPeriod: ChartPeriod
  onPeriodChange: (period: ChartPeriod) => void
  totalPeriodHours: number
  projectRows: ProjectTableRow[]
  className?: string
}

export function ProjectSummaryCommandCenter({
  loading,
  chartData,
  chartPeriod,
  onPeriodChange,
  totalPeriodHours,
  projectRows,
  className,
}: ProjectSummaryCommandCenterProps) {
  const [periodOpen, setPeriodOpen] = useState(false)

  return (
    <section
      className={cn(
        'project-summary-command-center dashboard-chart-card flex min-h-0 flex-col overflow-hidden',
        className,
      )}
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-[rgba(38,107,28,0.08)] px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold text-[#266b1c] sm:text-base">
            Project Summary Command Center
          </h2>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">{getChartSubtitle(chartPeriod)}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="text-right">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Total</p>
            <p className="font-display text-xl font-extrabold tabular-nums text-[#1a4712] sm:text-2xl">
              {loading ? '—' : formatHoursAsDuration(totalPeriodHours)}
            </p>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPeriodOpen(!periodOpen)}
              className="dashboard-period-btn flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold"
            >
              {chartPeriod}
              <ChevronDown className={cn('h-3 w-3 transition-transform', periodOpen && 'rotate-180')} />
            </button>
            {periodOpen && (
              <div className="cmd-dropdown absolute right-0 z-10 mt-1 min-w-[140px] p-1">
                {CHART_PERIODS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      onPeriodChange(p)
                      setPeriodOpen(false)
                    }}
                    className={cn('cmd-dropdown-item w-full', chartPeriod === p && 'cmd-dropdown-item-active')}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="project-summary-chart-zone shrink-0 px-3 pt-2 sm:px-4">
        {loading ? (
          <SkeletonBlock className="h-[92px] rounded-lg" />
        ) : (
          <ProjectHoursAreaChart data={chartData} compact height={92} />
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
        <p className="mb-1.5 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Current Project Table
        </p>
        <div className="project-summary-table-wrap min-h-0 flex-1 overflow-auto rounded-lg border border-[rgba(38,107,28,0.1)]">
          <table className="project-summary-table w-full min-w-[420px] border-collapse text-left">
            <thead className="sticky top-0 z-[1]">
              <tr>
                <th>Project</th>
                <th>Client</th>
                <th>Lead</th>
                <th className="text-right">Total Hours</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`project-row-skeleton-${i}`}>
                    <td colSpan={4}>
                      <div className="h-7 rounded bg-slate-100 skeleton" />
                    </td>
                  </tr>
                ))
              ) : projectRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-xs text-slate-500">
                    No project hours logged for this period.
                  </td>
                </tr>
              ) : (
                projectRows.map((row, index) => (
                  <tr key={row.id} className={index % 2 === 0 ? 'project-summary-row-even' : 'project-summary-row-odd'}>
                    <td className="font-semibold text-[#1f5516]">{row.project}</td>
                    <td>{row.client}</td>
                    <td>{row.lead}</td>
                    <td className="text-right font-bold tabular-nums text-[#266b1c]">{row.totalHours}h</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
