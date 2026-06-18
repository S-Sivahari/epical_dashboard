import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ProjectHoursDynamicBarChart } from '@components/charts/ProjectHoursDynamicBarChart'
import { AnimatedCounter } from './AnimatedCounter'
import { SkeletonBlock } from './shared'
import {
  CHART_PERIODS,
  getChartDateRangeSubtitle,
  type ChartPeriod,
  type ChartPeriodPreset,
} from '@/pages/admin/Dashboard/dashboardChartUtils'
import { cn } from '@/utils/cn'

export function ProjectHoursChartPanel({
  loading,
  chartData,
  chartPeriod,
  onPeriodChange,
  startDate,
  endDate,
  onDateRangeChange,
  totalPeriodHours,
  className,
}: {
  loading: boolean
  chartData: { name: string; hours: number }[]
  chartPeriod: ChartPeriodPreset
  onPeriodChange: (period: ChartPeriod) => void
  startDate: string
  endDate: string
  onDateRangeChange: (start: string, end: string) => void
  totalPeriodHours: number
  className?: string
}) {
  const [periodOpen, setPeriodOpen] = useState(false)
  const chartKey = useMemo(
    () => `${startDate}-${endDate}-${chartData.map((p) => `${p.name}:${p.hours}`).join('|')}`,
    [startDate, endDate, chartData],
  )
  const periodLabel = chartPeriod === 'Custom' ? 'Custom range' : chartPeriod

  const handleStartChange = (value: string) => {
    const nextEnd = value && endDate && value > endDate ? value : endDate
    onDateRangeChange(value, nextEnd)
  }

  const handleEndChange = (value: string) => {
    const nextStart = value && startDate && value < startDate ? value : startDate
    onDateRangeChange(nextStart, value)
  }

  return (
    <section className={cn('dashboard-panel dashboard-project-chart min-h-0', className)}>
      <header className="dashboard-panel-header dashboard-panel-header--primary">
        <div className="min-w-0">
          <h2 className="dashboard-panel-title">Project Hours</h2>
          <p className="dashboard-panel-subtitle">{getChartDateRangeSubtitle(startDate, endDate)}</p>
        </div>
        <div className="dashboard-project-header-controls">
          <div className="relative">
            <button
              type="button"
              onClick={() => setPeriodOpen(!periodOpen)}
              className="dashboard-period-btn flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold"
            >
              {periodLabel}
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

          <div className="dashboard-project-date-range">
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => handleStartChange(e.target.value)}
              className="dashboard-project-date-input"
              aria-label="Start date"
            />
            <span className="dashboard-project-date-sep" aria-hidden>
              –
            </span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => handleEndChange(e.target.value)}
              className="dashboard-project-date-input"
              aria-label="End date"
            />
          </div>

          <p className="dashboard-project-total-inline">
            <span>Total</span>
            <span aria-hidden> - </span>
            <span className="dashboard-project-total-value">
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
            </span>
          </p>
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
