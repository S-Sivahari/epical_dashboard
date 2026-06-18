import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ProjectHoursDynamicBarChart } from '@components/charts/ProjectHoursDynamicBarChart'
import { AnimatedCounter } from './AnimatedCounter'
import { SkeletonBlock } from './shared'
import {
  CHART_PERIODS,
  getChartSubtitle,
  type ChartPeriod,
} from '@/pages/admin/Dashboard/dashboardChartUtils'
import { cn } from '@/utils/cn'

export function ProjectHoursChartPanel({
  loading,
  chartData,
  chartPeriod,
  onPeriodChange,
  totalPeriodHours,
  className,
}: {
  loading: boolean
  chartData: { name: string; hours: number }[]
  chartPeriod: ChartPeriod
  onPeriodChange: (period: ChartPeriod) => void
  totalPeriodHours: number
  className?: string
}) {
  const [periodOpen, setPeriodOpen] = useState(false)
  const chartKey = useMemo(
    () => `${chartPeriod}-${chartData.map((p) => `${p.name}:${p.hours}`).join('|')}`,
    [chartPeriod, chartData],
  )

  return (
    <section className={cn('dashboard-panel dashboard-project-chart min-h-0', className)}>
      <header className="dashboard-panel-header dashboard-panel-header--primary">
        <div>
          <h2 className="dashboard-panel-title">Project Hours</h2>
          <p className="dashboard-panel-subtitle">{getChartSubtitle(chartPeriod)}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="dashboard-panel-meta">Total</p>
            <p className="dashboard-panel-stat">
              {loading ? (
                '—'
              ) : (
                <AnimatedCounter
                  value={totalPeriodHours}
                  suffix="h"
                  duration={0.85}
                  className="tabular-nums"
                />
              )}
            </p>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPeriodOpen(!periodOpen)}
              className="dashboard-period-btn flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold"
            >
              {chartPeriod}
              <ChevronDown className={cn('h-4 w-4 transition-transform', periodOpen && 'rotate-180')} />
            </button>
            {periodOpen && (
              <div className="cmd-dropdown absolute right-0 z-10 mt-1 min-w-[160px] p-1">
                {CHART_PERIODS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      onPeriodChange(p)
                      setPeriodOpen(false)
                    }}
                    className={cn('cmd-dropdown-item w-full text-sm', chartPeriod === p && 'cmd-dropdown-item-active')}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="dashboard-project-chart-body">
        {loading ? (
          <SkeletonBlock className="h-[240px] rounded-xl" />
        ) : chartData.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center rounded-xl text-sm font-medium text-slate-500">
            No hours logged for this period
          </div>
        ) : (
          <ProjectHoursDynamicBarChart
            data={chartData}
            chartKey={chartKey}
            height={240}
            className="max-w-full overflow-hidden"
          />
        )}
      </div>
    </section>
  )
}
