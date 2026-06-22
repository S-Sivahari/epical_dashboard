import { useId, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipProps } from 'recharts'
import { easeOut } from '@/utils/motionPresets'
import { cn } from '@/utils/cn'

type ChartPoint = { name: string; hours: number }

function computeNiceYAxis(maxValue: number): { yMax: number; ticks: number[] } {
  if (maxValue <= 0) {
    return { yMax: 8, ticks: [0, 2, 4, 6, 8] }
  }

  const targetTickCount = 5
  const paddedMax = maxValue * 1.12
  const roughStep = paddedMax / (targetTickCount - 1)
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const normalized = roughStep / magnitude

  let step = magnitude
  if (normalized <= 1) step = magnitude
  else if (normalized <= 2) step = 2 * magnitude
  else if (normalized <= 5) step = 5 * magnitude
  else step = 10 * magnitude

  const yMax = Math.ceil(paddedMax / step) * step
  const tickCount = Math.round(yMax / step) + 1
  const ticks = Array.from({ length: tickCount }, (_, index) => index * step)

  return { yMax, ticks }
}

function formatBarLabel(v: unknown) {
  if (typeof v !== 'number' || Number.isNaN(v) || v === 0) return ''
  return v.toFixed(1)
}

function DynamicBarTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const hours = Number(payload[0]?.value ?? 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: easeOut }}
      className="project-hours-bar-tooltip"
    >
      <p className="project-hours-bar-tooltip__label">{label}</p>
      <p className="project-hours-bar-tooltip__value">
        {hours.toFixed(1)}
        <span className="project-hours-bar-tooltip__unit"> hrs</span>
      </p>
    </motion.div>
  )
}

export function ProjectHoursDynamicBarChart({
  data,
  chartKey,
  height = 240,
  className,
}: {
  data: ChartPoint[]
  chartKey: string
  height?: number
  className?: string
}) {
  const gradId = useId().replace(/:/g, '')

  const { yMax, ticks: yTicks } = useMemo(() => {
    const peak = data.reduce((max, row) => Math.max(max, row.hours ?? 0), 0)
    return computeNiceYAxis(peak)
  }, [data])

  const labelCount = data.length
  const peak = data.reduce((max, row) => Math.max(max, row.hours ?? 0), 0)
  const useAngledLabels = labelCount > 4
  const xTickInterval = labelCount > 12 ? Math.max(0, Math.floor(labelCount / 10)) : 0
  const chartHeight = height + (useAngledLabels ? 28 : 0)
  const barSize = labelCount > 14 ? 14 : labelCount > 8 ? 18 : labelCount > 4 ? 24 : 30

  return (
    <div className={cn('project-hours-dynamic-bar-chart', className)} style={{ height: chartHeight, minHeight: chartHeight }}>
      <div className="project-hours-dynamic-bar-chart__ambient" aria-hidden />
      <motion.div
        key={chartKey}
        className="project-hours-dynamic-bar-chart__canvas"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: easeOut }}
      >
        <ResponsiveContainer width="100%" height={chartHeight} minHeight={chartHeight}>
          <BarChart
            data={data}
            margin={{ top: 20, right: 12, left: 4, bottom: useAngledLabels ? 8 : 4 }}
            barCategoryGap={labelCount > 10 ? '18%' : '32%'}
          >
              <defs>
                <linearGradient id={`dynBarBase-${gradId}`} x1="0" y1="1" x2="0.18" y2="0">
                  <stop offset="0%" stopColor="#1b4332" stopOpacity={1} />
                  <stop offset="14%" stopColor="#266b1c" stopOpacity={1} />
                  <stop offset="28%" stopColor="#2f7a24" stopOpacity={0.96} />
                  <stop offset="42%" stopColor="#266b1c" stopOpacity={1} />
                  <stop offset="58%" stopColor="#2f7a24" stopOpacity={0.94} />
                  <stop offset="72%" stopColor="#266b1c" stopOpacity={1} />
                  <stop offset="86%" stopColor="#3a912d" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#4caf50" stopOpacity={0.9} />
                </linearGradient>
                <linearGradient id={`dynBarPeak-${gradId}`} x1="0" y1="1" x2="0.18" y2="0">
                  <stop offset="0%" stopColor="#1a4a14" stopOpacity={1} />
                  <stop offset="16%" stopColor="#2f7d24" stopOpacity={1} />
                  <stop offset="34%" stopColor="#3a912d" stopOpacity={0.98} />
                  <stop offset="50%" stopColor="#2f7d24" stopOpacity={1} />
                  <stop offset="68%" stopColor="#45a838" stopOpacity={0.96} />
                  <stop offset="84%" stopColor="#4caf50" stopOpacity={1} />
                  <stop offset="100%" stopColor="#6fcf6f" stopOpacity={0.95} />
                </linearGradient>
                <linearGradient id={`dynBarHover-${gradId}`} x1="0" y1="1" x2="0.18" y2="0">
                  <stop offset="0%" stopColor="#266b1c" stopOpacity={1} />
                  <stop offset="20%" stopColor="#3a912d" stopOpacity={1} />
                  <stop offset="40%" stopColor="#45a838" stopOpacity={0.96} />
                  <stop offset="60%" stopColor="#3a912d" stopOpacity={1} />
                  <stop offset="80%" stopColor="#5cb85c" stopOpacity={0.98} />
                  <stop offset="100%" stopColor="#7dd87d" stopOpacity={0.92} />
                </linearGradient>
              </defs>

              <CartesianGrid
                stroke="rgba(38, 107, 28, 0.08)"
                vertical={false}
                strokeDasharray="5 8"
              />
              <XAxis
                dataKey="name"
                tick={{
                  fill: '#475569',
                  fontSize: labelCount > 10 ? 9 : 11,
                  fontWeight: 600,
                }}
                axisLine={false}
                tickLine={false}
                interval={xTickInterval}
                angle={useAngledLabels ? -35 : 0}
                textAnchor={useAngledLabels ? 'end' : 'middle'}
                height={useAngledLabels ? 58 : 28}
                dy={useAngledLabels ? 4 : 8}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                width={40}
                domain={[0, yMax]}
                allowDecimals={false}
                ticks={yTicks}
                tickFormatter={(v) => `${v}h`}
              />
              <Tooltip
                content={<DynamicBarTooltip />}
                cursor={{ fill: 'rgba(38, 107, 28, 0.1)', radius: 8 }}
              />
              <Bar
                dataKey="hours"
                barSize={barSize}
                maxBarSize={36}
                radius={[10, 10, 4, 4]}
                isAnimationActive
                animationDuration={1000}
                animationEasing="ease-out"
                activeBar={{
                  fill: `url(#dynBarHover-${gradId})`,
                  stroke: '#266b1c',
                  strokeWidth: 1,
                  radius: 10,
                }}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`bar-${index}`}
                    fill={
                      entry.hours === peak && peak > 0
                        ? `url(#dynBarPeak-${gradId})`
                        : `url(#dynBarBase-${gradId})`
                    }
                    fillOpacity={entry.hours > 0 ? 1 : 0.4}
                  />
                ))}
                <LabelList
                  dataKey="hours"
                  position="top"
                  formatter={formatBarLabel}
                  fill="#1f5516"
                  fontSize={11}
                  fontWeight={700}
                />
              </Bar>
            </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  )
}
