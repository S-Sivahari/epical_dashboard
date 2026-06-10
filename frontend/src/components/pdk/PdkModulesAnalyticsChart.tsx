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
import type { PdkModule } from '@/types/pdkMetalRouting'
import { cn } from '@/utils/cn'
import { stringToHueColor } from '@/utils/stringColor'

function shortenLabel(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

type ChartRow = {
  id: string
  label: string
  fullName: string
  metals: number
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
        {row.metals} metal type{row.metals === 1 ? '' : 's'}
      </p>
    </div>
  )
}

function SidebarHorizontalChart({ data, fill }: { data: ChartRow[]; fill?: boolean }) {
  const chartHeight = data.length * 26 + 8

  return (
    <div
      className={cn(
        'metal-routing-analytics-chart metal-routing-analytics-chart--sidebar-horizontal',
        fill && 'metal-routing-analytics-chart--fill',
      )}
    >
      <ResponsiveContainer width="100%" height={fill ? '100%' : chartHeight}>
        <BarChart
          layout="vertical"
          data={data}
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
          <Bar dataKey="metals" radius={[0, 4, 4, 0]} maxBarSize={fill ? 22 : 12}>
            {data.map((entry) => (
              <Cell key={entry.id} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function DefaultVerticalChart({ data, height }: { data: ChartRow[]; height: number }) {
  return (
    <div className="metal-routing-analytics-chart metal-routing-analytics-chart--sidebar">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(15, 23, 42, 0.06)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={42}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 9, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            width={24}
          />
          <Tooltip cursor={{ fill: 'rgba(30, 90, 61, 0.06)' }} content={<ChartTooltip />} />
          <Bar dataKey="metals" radius={[4, 4, 0, 0]} maxBarSize={22}>
            {data.map((entry) => (
              <Cell key={entry.id} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PdkModulesAnalyticsChart({
  modules,
  loading,
  sidebar,
  fill,
}: {
  modules: PdkModule[]
  loading?: boolean
  sidebar?: boolean
  fill?: boolean
}) {
  const metalsPerModule = useMemo(
    () =>
      [...modules]
        .sort((a, b) => b.metals.length - a.metals.length)
        .slice(0, sidebar ? 4 : 6)
        .map((mod) => ({
          id: mod._id,
          label: shortenLabel(mod.name, sidebar ? 11 : 8),
          fullName: mod.name,
          metals: mod.metals.length,
          color: stringToHueColor(mod._id || mod.name),
        })),
    [modules, sidebar],
  )

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

  if (modules.length === 0) {
    return (
      <article
        className={cn(
          'metal-routing-analytics-card metal-routing-analytics-card--compact',
          sidebar && 'metal-routing-analytics-card--sidebar',
        )}
      >
        <h3 className="metal-routing-analytics-title">Metal overview</h3>
        <p className="metal-routing-analytics-empty">Add modules to see distribution.</p>
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
      <h3 className="metal-routing-analytics-title">Metal types per module</h3>
      {sidebar ? (
        <SidebarHorizontalChart data={metalsPerModule} fill={fill} />
      ) : (
        <DefaultVerticalChart data={metalsPerModule} height={150} />
      )}
    </article>
  )
}
