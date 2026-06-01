import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ProjectHoursAreaChart } from '@components/charts/ProjectHoursAreaChart'
import { SkeletonBlock } from './shared'
import {
  CHART_PERIODS,
  getChartSubtitle,
  type ChartPeriod,
} from '@/pages/admin/Dashboard/dashboardChartUtils'
import { cn } from '@/utils/cn'

interface ProjectHoursPanelProps {
  loading: boolean
  chartData: { name: string; hours: number }[]
  chartPeriod: ChartPeriod
  onPeriodChange: (period: ChartPeriod) => void
  totalPeriodHours: number
  className?: string
}

export function ProjectHoursPanel({
  loading,
  chartData,
  chartPeriod,
  onPeriodChange,
  totalPeriodHours,
  className,
}: ProjectHoursPanelProps) {
  const [periodOpen, setPeriodOpen] = useState(false)

  return (
    <section className={cn('dashboard-chart-card project-hours-panel flex min-h-0 flex-col', className)}>
      <div className="mb-3 flex shrink-0 flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <div>
          <h2 className="font-display text-base font-semibold text-[#266b1c] sm:text-lg">Project Hours</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500">{getChartSubtitle(chartPeriod)}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {chartPeriod}
            </p>
            <p className="font-display text-2xl font-bold tabular-nums text-[#1f5516] sm:text-[1.65rem]">
              {loading ? '—' : `${totalPeriodHours}h`}
            </p>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPeriodOpen(!periodOpen)}
              className="dashboard-period-btn flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
            >
              Period
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

      <div className="min-h-0 flex-1 px-2 pb-3 sm:px-3 sm:pb-4">
        {loading ? (
          <SkeletonBlock className="mx-2 h-full min-h-[140px] rounded-xl" />
        ) : (
          <ProjectHoursAreaChart data={chartData} fillParent height={180} />
        )}
      </div>
    </section>
  )
}
