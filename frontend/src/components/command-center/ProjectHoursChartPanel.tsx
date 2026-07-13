import { useMemo, useState } from 'react'
import { ProjectHoursDynamicBarChart } from '@components/charts/ProjectHoursDynamicBarChart'
import {
  ProjectHoursPeriodDialog,
  ProjectHoursPeriodTrigger,
} from './ProjectHoursPeriodDialog'
import { SkeletonBlock } from './shared'
import {
  formatDateKey,
  getChartSubtitleForRange,
  type ChartDateRange,
} from '@/pages/admin/Dashboard/dashboardChartUtils'
import { formatHoursDecimalAsLongDuration } from '@/utils/durationFormat'
import { cn } from '@/utils/cn'

export function ProjectHoursChartPanel({
  chartLoading,
  chartData,
  chartDateRange,
  onDateRangeChange,
  totalPeriodHours,
  className,
}: {
  chartLoading: boolean
  chartData: { name: string; hours: number }[]
  chartDateRange: ChartDateRange
  onDateRangeChange: (range: ChartDateRange) => void
  totalPeriodHours: number
  className?: string
}) {
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false)

  const chartKey = useMemo(
    () =>
      [
        chartDateRange.from,
        chartDateRange.to,
        chartDateRange.selectionMode,
        chartDateRange.selectedDays?.join(','),
        chartDateRange.selectedMonths?.join(','),
        chartDateRange.selectedYears?.join(','),
        chartData.map((p) => `${p.name}:${p.hours}`).join('|'),
      ].join('-'),
    [
      chartDateRange.from,
      chartDateRange.to,
      chartDateRange.selectionMode,
      chartDateRange.selectedDays,
      chartDateRange.selectedMonths,
      chartDateRange.selectedYears,
      chartData,
    ],
  )

  const today = formatDateKey(new Date())

  return (
    <section className={cn('dashboard-panel dashboard-project-chart min-h-0', className)}>
      <header className="dashboard-panel-header dashboard-panel-header--primary dashboard-project-chart-header">
        <div className="dashboard-project-chart-header-top">
          <div>
            <h2 className="dashboard-panel-title">Project Hours</h2>
            <p className="dashboard-panel-subtitle">
              {getChartSubtitleForRange(chartDateRange)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="dashboard-panel-meta">Total</p>
              <p className="dashboard-panel-stat tabular-nums">
                {chartLoading ? '—' : formatHoursDecimalAsLongDuration(totalPeriodHours)}
              </p>
            </div>
            <ProjectHoursPeriodTrigger
              range={chartDateRange}
              onClick={() => setPeriodDialogOpen(true)}
            />
          </div>
        </div>
      </header>

      <ProjectHoursPeriodDialog
        open={periodDialogOpen}
        onClose={() => setPeriodDialogOpen(false)}
        value={chartDateRange}
        maxDate={today}
        onApply={onDateRangeChange}
      />

      <div className="dashboard-project-chart-body">
        {chartLoading ? (
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
