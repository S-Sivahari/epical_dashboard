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

  const { yMax, yTicks } = useMemo(() => {
    const peak = data.reduce((max, row) => Math.max(max, row.hours ?? 0), 0)
    if (peak <= 0) {
      return { yMax: 8, yTicks: [0, 2, 4, 6, 8] }
    }
    const padded = Math.ceil(peak * 1.2)
    const step = padded <= 10 ? 2 : padded <= 40 ? 5 : padded <= 100 ? 10 : 20
    const max = Math.ceil(padded / step) * step
    const ticks: number[] = []
    for (let v = 0; v <= max; v += step) ticks.push(v)
    return { yMax: max, yTicks: ticks }
  }, [data])

  const labelCount = data.length
  const useAngledLabels = labelCount > 3
  const chartHeight = fillParent ? undefined : height
  const xAxisHeight = useAngledLabels ? 64 : 28
  const margin = compact
    ? {
        top: 4,
        right: 8,
        left: -12,
        bottom: useAngledLabels ? 8 : 4,
      }
    : {
        top: 12,
        right: 20,
        left: 4,
        bottom: useAngledLabels ? 4 : 8,
      }

  return (
    <div
      className={cn(
        'w-full',
        fillParent ? 'h-full min-h-0 flex-1' : 'shrink-0',
        compact && 'project-hours-chart-compact',
        className,
      )}
      style={chartHeight != null ? { height: chartHeight + (useAngledLabels ? 28 : 0) } : undefined}
    >
      <ResponsiveContainer width="100%" height={fillParent ? '100%' : chartHeight! + (useAngledLabels ? 28 : 0)}>
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
            tick={{
              fill: CHART_GREEN.axis,
              fontSize: labelCount > 7 ? 9 : compact ? 10 : 11,
              fontWeight: 500,
            }}
            axisLine={false}
            tickLine={false}
            dy={useAngledLabels ? 4 : compact ? 2 : 6}
            interval={0}
            angle={useAngledLabels ? -38 : 0}
            textAnchor={useAngledLabels ? 'end' : 'middle'}
            height={xAxisHeight}
            minTickGap={0}
            padding={{ left: 12, right: 12 }}
          />
          {!compact && (
            <YAxis
              tick={{ fill: CHART_GREEN.axis, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={44}
              domain={[0, yMax]}
              ticks={yTicks}
              tickFormatter={(v) => `${v}h`}
            />
          )}
          <Tooltip
            cursor={{ stroke: 'rgba(38, 107, 28, 0.25)', strokeWidth: 1 }}
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid rgba(38, 107, 28, 0.18)',
              borderRadius: 10,
              fontSize: 14,
              boxShadow: '0 8px 24px rgba(38, 107, 28, 0.12)',
            }}
            labelStyle={{ color: '#266b1c', fontWeight: 600, marginBottom: 4 }}
            formatter={(value: number) => [`${value} h`, 'Hours logged']}
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
