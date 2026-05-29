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

const tooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid rgb(209 250 229)',
  borderRadius: 12,
  color: '#0f172a',
  fontSize: 12,
  boxShadow: '0 4px 24px -4px rgba(15,118,110,0.18)',
}

function formatHoursLabel(v: unknown) {
  if (typeof v !== 'number' || Number.isNaN(v)) return ''
  return v.toFixed(2)
}

export function HoursBarChart({ data }: { data: { name: string; hours: number }[] }) {
  const gradId = useId().replace(/:/g, '')

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
          <CartesianGrid strokeDasharray="3 6" stroke="rgb(226 232 240 / 0.9)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(22,163,74,0.06)' }} />
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
              fill="#065f46"
              fontSize={12}
              fontWeight={600}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
