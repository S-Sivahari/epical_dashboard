import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DashboardProject } from '@/types/pdkMetalRouting'
import { cn } from '@/utils/cn'

type ChartRow = {
  id: string
  label: string
  fullName: string
  count: number
  color: string
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartRow }>
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="metal-routing-analytics-tooltip">
      <p className="font-semibold text-ink">{row.fullName}</p>
      <p className="text-xs text-muted">
        {row.count} project{row.count === 1 ? '' : 's'}
      </p>
    </div>
  )
}

export function CellRoutingAnalyticsChart({
  projects,
  loading,
  sidebar,
  fill,
}: {
  projects: DashboardProject[]
  loading?: boolean
  sidebar?: boolean
  fill?: boolean
}) {
  const chartData = useMemo(() => {
    const assigned = projects.filter((p) => p.pdkModuleId).length
    const unassigned = projects.length - assigned
    const rows: ChartRow[] = [
      {
        id: 'assigned',
        label: 'Assigned',
        fullName: 'PDK assigned',
        count: assigned,
        color: '#1e5a3d',
      },
      {
        id: 'unassigned',
        label: 'Unassigned',
        fullName: 'No PDK assigned',
        count: unassigned,
        color: '#ea580c',
      },
    ]
    return sidebar ? rows : rows.filter((row) => row.count > 0)
  }, [projects, sidebar])

  const chartHeight = chartData.length * 26 + 8

  if (loading) {
    return (
      <div
        className={cn(
          'metal-routing-analytics-card metal-routing-analytics-card--loading',
          sidebar && 'metal-routing-analytics-card--sidebar',
          sidebar && fill && 'metal-routing-analytics-card--sidebar-fill',
        )}
        aria-hidden
      >
        <div
          className={cn(
            'metal-routing-skeleton metal-routing-analytics-skeleton metal-routing-analytics-skeleton--compact',
            sidebar && !fill && 'metal-routing-analytics-skeleton--sidebar-horizontal',
            sidebar && fill && 'metal-routing-analytics-skeleton--sidebar-fill',
          )}
        />
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <article
        className={cn(
          'metal-routing-analytics-card metal-routing-analytics-card--compact',
          sidebar && 'metal-routing-analytics-card--sidebar',
        )}
      >
        <h3 className="metal-routing-analytics-title">PDK assignment</h3>
        <p className="metal-routing-analytics-empty">No projects to chart yet.</p>
      </article>
    )
  }

  return (
    <article
      className={cn(
        'metal-routing-analytics-card metal-routing-analytics-card--compact',
        sidebar && 'metal-routing-analytics-card--sidebar',
        sidebar && fill && 'metal-routing-analytics-card--sidebar-fill',
      )}
    >
      <h3 className="metal-routing-analytics-title">PDK assignment</h3>
      <div
        className={cn(
          'metal-routing-analytics-chart metal-routing-analytics-chart--sidebar-horizontal',
          fill && 'metal-routing-analytics-chart--fill',
        )}
      >
        <ResponsiveContainer width="100%" height={fill ? '100%' : chartHeight}>
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: fill ? 8 : 2, right: 8, left: 0, bottom: fill ? 8 : 2 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.06)" />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fontSize: 9, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              height={18}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={76}
              tick={{ fontSize: 9, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: 'rgba(30, 90, 61, 0.06)' }} content={<ChartTooltip />} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={fill ? 22 : 12}>
              {chartData.map((entry) => (
                <Cell key={entry.id} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}
