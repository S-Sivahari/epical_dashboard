import { useMemo, useState } from 'react'
import { ProjectHoursDynamicBarChart } from '@components/charts/ProjectHoursDynamicBarChart'
import { ChartDateRangePicker } from './ChartDateRangePicker'
import { AnimatedCounter } from './AnimatedCounter'
import { SkeletonBlock } from './shared'
import {
  CHART_QUICK_FILTERS,
  formatDateKey,
  getChartSubtitleForRange,
  getQuickFilterDateRange,
  matchQuickFilter,
  type ChartDateRange,
  type ChartQuickFilter,
} from '@/pages/admin/Dashboard/dashboardChartUtils'
import { cn } from '@/utils/cn'

export function ProjectHoursChartPanel({
  loading,
  chartData,
  chartDateRange,
  onDateRangeChange,
  totalPeriodHours,
  className,
}: {
  loading: boolean
  chartData: { name: string; hours: number }[]
  chartDateRange: ChartDateRange
  onDateRangeChange: (range: ChartDateRange) => void
  totalPeriodHours: number
  className?: string
}) {
  const [calendarOpen, setCalendarOpen] = useState(false)

  const activeFilter = useMemo(() => matchQuickFilter(chartDateRange), [chartDateRange])

  const chartKey = useMemo(
    () =>
      `${chartDateRange.from}-${chartDateRange.to}-${chartData.map((p) => `${p.name}:${p.hours}`).join('|')}`,
    [chartDateRange.from, chartDateRange.to, chartData],
  )

  const today = formatDateKey(new Date())

  const handleFilterClick = (filter: ChartQuickFilter) => {
    if (filter === 'Custom') {
      setCalendarOpen(true)
      return
    }
    onDateRangeChange(getQuickFilterDateRange(filter))
  }

  return (
    <section className={cn('dashboard-panel dashboard-project-chart min-h-0', className)}>
      <header className="dashboard-panel-header dashboard-panel-header--primary dashboard-project-chart-header">
        <div className="dashboard-project-chart-header-top">
          <div>
            <h2 className="dashboard-panel-title">Project Hours</h2>
            <p className="dashboard-panel-subtitle">
              {getChartSubtitleForRange(chartDateRange.from, chartDateRange.to)}
            </p>
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
            <ChartDateRangePicker
              from={chartDateRange.from}
              to={chartDateRange.to}
              maxDate={today}
              open={calendarOpen}
              onOpenChange={setCalendarOpen}
              onChange={(from, to) => onDateRangeChange({ from, to })}
            />
          </div>
        </div>

        <div
          className="dashboard-project-chart-filters"
          role="tablist"
          aria-label="Project hours period"
        >
          <span className="dashboard-project-chart-filters-label">Period</span>
          <div className="dashboard-project-chart-filters-options">
            {CHART_QUICK_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeFilter === id}
                className={cn(
                  'dashboard-project-chart-filter',
                  activeFilter === id && 'dashboard-project-chart-filter--active',
                )}
                onClick={() => handleFilterClick(id)}
              >
                {label}
              </button>
            ))}
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
