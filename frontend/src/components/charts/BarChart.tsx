import { useId } from 'react'
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
  if (!brand) return '#4ade80' // light theme: plain green
  return CREWIQ_COLORS[index % CREWIQ_COLORS.length]
}

export function HoursBarChart({
  data,
  theme = 'light',
  brand = false,
}: {
  data: { name: string; hours: number }[]
  theme?: 'light' | 'dark'
  brand?: boolean
}) {
  const gradId = useId().replace(/:/g, '')
  const isDark = theme === 'dark'

  const tooltipStyle = isDark
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

  const axisColor = isDark ? '#4a5568' : '#64748b'
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgb(226 232 240 / 0.9)'
  const labelFill = isDark ? 'rgba(255,255,255,0.65)' : '#065f46'
  const cursorFill = isDark
    ? brand
      ? 'rgba(79,142,247,0.06)'
      : 'rgba(79,142,247,0.08)'
    : 'rgba(22,163,74,0.06)'

  // For the dark brand dashboard — single green gradient like reference
  const useCellColors = false

  return (
    <div className="h-full min-h-[220px] w-full flex-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 8, left: -8, bottom: 0 }}
          barCategoryGap="40%"
        >
          <defs>
            {/* Fallback gradient for non-brand or light mode */}
            <linearGradient id={`hoursBarGrad-${gradId}`} x1="0" y1="1" x2="0" y2="0">
              {brand && isDark ? (
                <>
                  <stop offset="0%" stopColor="#00a152" stopOpacity={1} />
                  <stop offset="55%" stopColor="#00e676" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#69f0ae" stopOpacity={0.85} />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#059669" stopOpacity={1} />
                  <stop offset="65%" stopColor="#34d399" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#d1fae5" stopOpacity={0.9} />
                </>
              )}
            </linearGradient>

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
            tick={{ fill: axisColor, fontSize: 11, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: axisColor, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={34}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: cursorFill }}
            formatter={(v: number) => [`${v}h`, 'Hours']}
          />
          <Bar
            dataKey="hours"
            fill={`url(#hoursBarGrad-${gradId})`}
            radius={[6, 6, 0, 0]}
            barSize={14}
            maxBarSize={20}
            isAnimationActive
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
