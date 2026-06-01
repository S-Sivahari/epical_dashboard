import { useId, useMemo } from 'react'
import { cn } from '@/utils/cn'
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

function formatHoursLabel(v: unknown) {
  if (typeof v !== 'number' || Number.isNaN(v)) return ''
  if (v === 0) return ''
  return v.toFixed(1)
}

// ── Colour palette that matches the reference image ──────────────────────────
// The image shows bars in blue (#4f8ef7-ish), green (#4ade80), and coral/red
// We cycle through these for multi-bar visual richness on the dark dashboard
const CREWIQ_COLORS = [
  '#4f8ef7', // blue
  '#38bdf8', // sky
  '#a78bfa', // violet
  '#34d399', // emerald
  '#fb923c', // orange
  '#f472b6', // pink
  '#facc15', // amber
]

function getDarkBarColor(index: number, brand: boolean) {
  if (!brand) return '#266b1c'
  return CREWIQ_COLORS[index % CREWIQ_COLORS.length]
}

const DASHBOARD_GREEN = {
  dark: '#266b1c',
  mid: '#266b1c',
  deep: '#1f5516',
  bright: '#2f7d24',
  hover: '#3a912d',
  axis: '#0f172a',
  axisMuted: '#334155',
  label: '#0f172a',
  grid: 'rgba(15, 23, 42, 0.08)',
  cursor: 'rgba(38, 107, 28, 0.14)',
}

export function HoursBarChart({
  data,
  theme = 'light',
  brand = false,
  colorScheme = 'default',
  height = 280,
  fillParent = false,
  animate = true,
  className,
}: {
  data: { name: string; hours: number }[]
  theme?: 'light' | 'dark'
  brand?: boolean
  colorScheme?: 'default' | 'dashboard'
  /** Fixed pixel height for the chart area (prevents layout shift). Ignored when fillParent is true. */
  height?: number
  /** Grow to fill a flex parent (e.g. admin dashboard card). */
  fillParent?: boolean
  animate?: boolean
  className?: string
}) {
  const gradId = useId().replace(/:/g, '')
  const isDark = theme === 'dark'
  const isDashboard = colorScheme === 'dashboard'

  const tooltipStyle = isDashboard
    ? {
        backgroundColor: DASHBOARD_GREEN.dark,
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 10,
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 600,
        boxShadow: '0 8px 24px rgba(20, 83, 45, 0.35)',
      }
    : isDark
      ? {
          backgroundColor: '#161b27',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 12,
          color: '#ffffff',
          fontSize: 12,
          boxShadow: '0 12px 32px -8px rgba(0,0,0,0.7)',
        }
      : {
          backgroundColor: '#ffffff',
          border: '1px solid rgb(209 250 229)',
          borderRadius: 12,
          color: '#0f172a',
          fontSize: 12,
          boxShadow: '0 4px 24px -4px rgba(15,118,110,0.18)',
        }

  const axisColor = isDashboard ? DASHBOARD_GREEN.axisMuted : isDark ? '#4a5568' : '#64748b'
  const gridColor = isDashboard ? DASHBOARD_GREEN.grid : isDark ? 'rgba(255,255,255,0.05)' : 'rgb(226 232 240 / 0.9)'
  const labelFill = isDashboard ? DASHBOARD_GREEN.label : isDark ? 'rgba(255,255,255,0.65)' : '#266b1c'
  const cursorFill = isDashboard
    ? DASHBOARD_GREEN.cursor
    : isDark
      ? brand
        ? 'rgba(79,142,247,0.06)'
        : 'rgba(79,142,247,0.08)'
      : 'rgba(22,163,74,0.06)'

  // For the dark brand dashboard — single green gradient like reference
  const useCellColors = false

  const yMax = useMemo(() => {
    const peak = data.reduce((max, row) => Math.max(max, row.hours ?? 0), 0)
    return Math.max(8, Math.ceil(peak * 1.25))
  }, [data])

  const chartHeight = fillParent ? undefined : height

  return (
    <div
      className={cn(
        'w-full shrink-0 overflow-hidden',
        fillParent ? 'h-full min-h-[220px] flex-1' : '',
        className,
      )}
      style={chartHeight != null ? { height: chartHeight } : undefined}
    >
      <ResponsiveContainer width="100%" height={fillParent ? '100%' : chartHeight}>
        <BarChart
          data={data}
          margin={{ top: 24, right: 8, left: 0, bottom: 4 }}
          barCategoryGap="40%"
        >
          <defs>
            {/* Fallback gradient for non-brand or light mode */}
            <linearGradient id={`hoursBarGrad-${gradId}`} x1="0" y1="1" x2="0" y2="0">
              {isDashboard ? (
                <>
                  <stop offset="0%" stopColor={DASHBOARD_GREEN.deep} stopOpacity={1} />
                  <stop offset="50%" stopColor={DASHBOARD_GREEN.dark} stopOpacity={1} />
                  <stop offset="100%" stopColor={DASHBOARD_GREEN.mid} stopOpacity={0.95} />
                </>
              ) : brand && isDark ? (
                <>
                  <stop offset="0%" stopColor="#00a152" stopOpacity={1} />
                  <stop offset="55%" stopColor="#00e676" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#69f0ae" stopOpacity={0.85} />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#266b1c" stopOpacity={1} />
                  <stop offset="65%" stopColor="#34d399" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#d1fae5" stopOpacity={0.9} />
                </>
              )}
            </linearGradient>

            {isDashboard && (
              <linearGradient id={`hoursBarHoverGrad-${gradId}`} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={DASHBOARD_GREEN.dark} stopOpacity={1} />
                <stop offset="55%" stopColor={DASHBOARD_GREEN.bright} stopOpacity={1} />
                <stop offset="100%" stopColor={DASHBOARD_GREEN.hover} stopOpacity={1} />
              </linearGradient>
            )}

            {/* Per-color gradients for cell mode */}
            {useCellColors &&
              CREWIQ_COLORS.map((color, i) => (
                <linearGradient key={i} id={`barCell-${gradId}-${i}`} x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor={color} stopOpacity={0.75} />
                  <stop offset="100%" stopColor={color} stopOpacity={1} />
                </linearGradient>
              ))}
          </defs>

          <CartesianGrid strokeDasharray="3 6" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: axisColor, fontSize: 11, fontWeight: isDashboard ? 600 : 500 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: axisColor, fontSize: 11, fontWeight: isDashboard ? 500 : 400 }}
            axisLine={false}
            tickLine={false}
            width={36}
            domain={[0, yMax]}
            allowDecimals={false}
            tickCount={5}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: cursorFill }}
            labelStyle={isDashboard ? { color: 'rgba(255,255,255,0.85)', fontWeight: 600 } : undefined}
            itemStyle={isDashboard ? { color: '#ffffff', fontWeight: 700 } : undefined}
            formatter={(v: number) => [`${v}h`, 'Hours']}
          />
          <Bar
            dataKey="hours"
            fill={`url(#hoursBarGrad-${gradId})`}
            radius={[6, 6, 0, 0]}
            barSize={14}
            maxBarSize={20}
            isAnimationActive={animate}
            activeBar={
              isDashboard
                ? {
                    fill: `url(#hoursBarHoverGrad-${gradId})`,
                    stroke: DASHBOARD_GREEN.dark,
                    strokeWidth: 1,
                    radius: 6,
                  }
                : undefined
            }
          >
            {useCellColors
              ? data.map((_entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={`url(#barCell-${gradId}-${index % CREWIQ_COLORS.length})`}
                    style={{
                      filter: `drop-shadow(0 0 6px ${getDarkBarColor(index, brand)}66)`,
                    }}
                  />
                ))
              : null}
            <LabelList
              dataKey="hours"
              position="top"
              formatter={formatHoursLabel}
              fill={labelFill}
              fontSize={11}
              fontWeight={600}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
