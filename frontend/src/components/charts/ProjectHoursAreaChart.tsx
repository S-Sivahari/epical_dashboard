import { useId, useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/utils/cn'

const CHART_GREEN = {
  line: '#266b1c',
  areaTop: 'rgba(58, 145, 45, 0.35)',
  areaBottom: 'rgba(207, 229, 203, 0.08)',
  axis: '#64748b',
  grid: 'rgba(100, 116, 139, 0.12)',
}

export function ProjectHoursAreaChart({
  data,
  fillParent = false,
  height = 200,
  compact = false,
  className,
}: {
  data: { name: string; hours: number }[]
  fillParent?: boolean
  height?: number
  compact?: boolean
  className?: string
}) {
  const gradId = useId().replace(/:/g, '')

  const yMax = useMemo(() => {
    const peak = data.reduce((max, row) => Math.max(max, row.hours ?? 0), 0)
    return Math.max(4, Math.ceil(peak * 1.3))
  }, [data])

  const chartHeight = fillParent ? undefined : height
  const margin = compact
    ? { top: 4, right: 4, left: -16, bottom: -4 }
    : { top: 12, right: 8, left: -8, bottom: 0 }

  return (
    <div
      className={cn(
        'w-full shrink-0 overflow-hidden',
        fillParent ? 'h-full min-h-[180px] flex-1' : '',
        compact && 'project-hours-chart-compact',
        className,
      )}
      style={chartHeight != null ? { height: chartHeight } : undefined}
    >
      <ResponsiveContainer width="100%" height={fillParent ? '100%' : chartHeight}>
        <ComposedChart data={data} margin={margin}>
          <defs>
            <linearGradient id={`hoursAreaGrad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3a912d" stopOpacity={0.45} />
              <stop offset="45%" stopColor="#2f7d24" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#e8f2e6" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART_GREEN.grid} vertical={false} strokeDasharray="4 6" />
          <XAxis
            dataKey="name"
            tick={{ fill: CHART_GREEN.axis, fontSize: compact ? 11 : 14, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            dy={compact ? 2 : 6}
            interval={compact ? 'preserveStartEnd' : 0}
          />
          {!compact && (
            <YAxis
              tick={{ fill: CHART_GREEN.axis, fontSize: 13 }}
              axisLine={false}
              tickLine={false}
              width={28}
              domain={[0, yMax]}
              tickFormatter={(v) => `${v}h`}
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid rgba(38, 107, 28, 0.18)',
              borderRadius: 10,
              fontSize: 15,
              boxShadow: '0 8px 24px rgba(38, 107, 28, 0.12)',
            }}
            labelStyle={{ color: '#266b1c', fontWeight: 600 }}
            formatter={(value: number) => [`${value} h`, 'Hours']}
          />
          <Area
            type="monotone"
            dataKey="hours"
            stroke="none"
            fill={`url(#hoursAreaGrad-${gradId})`}
            isAnimationActive
          />
          <Line
            type="monotone"
            dataKey="hours"
            stroke={CHART_GREEN.line}
            strokeWidth={compact ? 2 : 2.5}
            dot={compact ? false : { r: 3, fill: '#266b1c', stroke: '#ffffff', strokeWidth: 2 }}
            activeDot={{ r: compact ? 4 : 5, fill: '#2f7d24', stroke: '#ffffff', strokeWidth: 2 }}
            isAnimationActive
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
