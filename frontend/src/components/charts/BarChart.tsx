import { useId } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function formatHoursLabel(v: unknown) {
  if (typeof v !== 'number' || Number.isNaN(v)) return ''
  return v.toFixed(2)
}

export function HoursBarChart({
  data,
  theme = 'light',
}: {
  data: { name: string; hours: number }[]
  theme?: 'light' | 'dark'
}) {
  const gradId = useId().replace(/:/g, '')
  const isDark = theme === 'dark'

  const tooltipStyle = isDark
    ? {
        backgroundColor: '#3f3f46',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        color: '#ffffff',
        fontSize: 12,
        boxShadow: '0 8px 24px -8px rgba(0,0,0,0.5)',
      }
    : {
        backgroundColor: '#ffffff',
        border: '1px solid rgb(209 250 229)',
        borderRadius: 12,
        color: '#0f172a',
        fontSize: 12,
        boxShadow: '0 4px 24px -4px rgba(15,118,110,0.18)',
      }

  const axisColor = isDark ? '#8892a4' : '#64748b'
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgb(226 232 240 / 0.9)'
  const labelFill = isDark ? '#ffffff' : '#065f46'
  const cursorFill = isDark ? 'rgba(79,142,247,0.08)' : 'rgba(22,163,74,0.06)'

  return (
    <div className="h-48 w-full sm:h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 16, right: 8, left: -8, bottom: 0 }}
          barCategoryGap="38%"
        >
          <defs>
            <linearGradient id={`hoursBarGrad-${gradId}`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#059669" stopOpacity={1} />
              <stop offset="65%" stopColor="#34d399" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#d1fae5" stopOpacity={0.9} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: axisColor, fontSize: 12, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: axisColor, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: cursorFill }} />
          <Bar
            dataKey="hours"
            fill={`url(#hoursBarGrad-${gradId})`}
            radius={[8, 8, 0, 0]}
            barSize={16}
            maxBarSize={20}
            isAnimationActive
          >
            <LabelList
              dataKey="hours"
              position="top"
              formatter={formatHoursLabel}
              fill={labelFill}
              fontSize={12}
              fontWeight={600}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
