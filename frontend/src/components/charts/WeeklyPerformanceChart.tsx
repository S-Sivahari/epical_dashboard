import { useId, useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/utils/cn'

const GREEN = {
  primary: '#06C033',
  mid: '#15A34A',
  bright: '#22C55E',
  light: '#4ADE80',
  axis: '#64748b',
  grid: 'rgba(6, 192, 51, 0.12)',
}

type WeeklyPoint = { name: string; hours: number }

function AnalyticsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="analytics-floating-tooltip">
      <span className="analytics-floating-tooltip-label">{label}</span>
      <span className="analytics-floating-tooltip-value">{payload[0].value} hrs logged</span>
    </div>
  )
}

export function WeeklyPerformanceChart({
  data,
  height = 260,
  animate = true,
  className,
}: {
  data: WeeklyPoint[]
  height?: number
  animate?: boolean
  className?: string
}) {
  const gradId = useId().replace(/:/g, '')

  const yMax = useMemo(() => {
    const peak = data.reduce((max, row) => Math.max(max, row.hours ?? 0), 0)
    return Math.max(8, Math.ceil(peak * 1.2))
  }, [data])

  return (
    <div
      className={cn('w-full shrink-0 overflow-hidden', className)}
      style={{ height, minHeight: height, maxHeight: height }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={data}
          margin={{ top: 28, right: 16, left: 0, bottom: 4 }}
        >
          <defs>
            <linearGradient id={`weeklyAreaGrad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GREEN.light} stopOpacity={0.55} />
              <stop offset="35%" stopColor={GREEN.bright} stopOpacity={0.3} />
              <stop offset="70%" stopColor={GREEN.mid} stopOpacity={0.12} />
              <stop offset="100%" stopColor={GREEN.primary} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id={`weeklyLineGrad-${gradId}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={GREEN.mid} />
              <stop offset="50%" stopColor={GREEN.primary} />
              <stop offset="100%" stopColor={GREEN.bright} />
            </linearGradient>
            <filter id={`weeklyGlow-${gradId}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <CartesianGrid stroke={GREEN.grid} vertical={false} strokeDasharray="4 4" />
          <XAxis
            dataKey="name"
            tick={{ fill: GREEN.axis, fontSize: 12, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
            dy={4}
            interval={0}
          />
          <YAxis
            tick={{ fill: GREEN.axis, fontSize: 11, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            width={34}
            domain={[0, yMax]}
            allowDecimals={false}
            tickCount={5}
            tickFormatter={(v) => `${v}h`}
          />
          <Tooltip
            content={<AnalyticsTooltip />}
            cursor={{
              stroke: GREEN.primary,
              strokeWidth: 1.5,
              strokeDasharray: '4 4',
              strokeOpacity: 0.5,
            }}
            animationDuration={200}
          />
          <Area
            type="monotone"
            dataKey="hours"
            stroke="none"
            fill={`url(#weeklyAreaGrad-${gradId})`}
            isAnimationActive={animate}
            animationDuration={1400}
            animationEasing="ease-out"
          />
          <Line
            type="monotone"
            dataKey="hours"
            stroke={`url(#weeklyLineGrad-${gradId})`}
            strokeWidth={3}
            dot={{
              r: 5,
              fill: GREEN.primary,
              stroke: '#ffffff',
              strokeWidth: 2,
            }}
            activeDot={{
              r: 7,
              fill: GREEN.primary,
              stroke: '#ffffff',
              strokeWidth: 3,
              filter: `url(#weeklyGlow-${gradId})`,
            }}
            isAnimationActive={animate}
            animationDuration={1400}
            animationEasing="ease-out"
          >
            <LabelList
              dataKey="hours"
              position="top"
              offset={10}
              formatter={(v: number) => `${v}h`}
              fill="#0f172a"
              fontSize={12}
              fontWeight={700}
            />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
