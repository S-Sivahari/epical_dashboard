import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { HoursBarChart } from '@components/charts/BarChart'
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
    <section className={cn('admin-dash-card project-hours-panel flex min-h-0 flex-col p-3 sm:p-4', className)}>
      <div className="mb-2 flex shrink-0 flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">Project Hours</h2>
          <p className="text-xs font-medium text-slate-600">{getChartSubtitle(chartPeriod)}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Total</p>
            <p className="font-display text-lg font-bold tabular-nums text-slate-900">
              {loading ? '—' : `${totalPeriodHours} h`}
            </p>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPeriodOpen(!periodOpen)}
              className="cmd-period-btn flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold"
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

      <div className="min-h-0 flex-1">
        {loading ? (
          <SkeletonBlock className="h-full min-h-[120px]" />
        ) : (
          <HoursBarChart data={chartData} theme="light" colorScheme="dashboard" fillParent height={180} />
        )}
      </div>
    </section>
  )
}
