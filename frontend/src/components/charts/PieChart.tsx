import { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from 'recharts'

const COLORS = ['#266b1c', '#3b82f6', '#f59e0b', '#a855f7', '#64748b']

function CourseCompletionTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: { name: string; value: number }; color?: string }[]
}) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0].payload
  const color = payload[0].color ?? '#06C033'
  return (
    <div className="analytics-pie-tooltip">
      <span className="analytics-pie-tooltip-dot" style={{ backgroundColor: color }} />
      <div className="analytics-pie-tooltip-content">
        <span className="analytics-pie-tooltip-name">{name}</span>
        <span className="analytics-pie-tooltip-value">{value}%</span>
      </div>
    </div>
  )
}

function renderActiveShape(props: {
  cx: number
  cy: number
  innerRadius: number
  outerRadius: number
  startAngle: number
  endAngle: number
  fill: string
  payload?: { name: string; value: number }
}) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 3}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="none"
        style={{ filter: 'drop-shadow(0 4px 12px rgba(6, 192, 51, 0.25))' }}
      />
      {payload && (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#0f172a"
          fontSize={13}
          fontWeight={700}
        >
          {payload.value}%
        </text>
      )}
    </g>
  )
}

export function DepartmentPieChart({
  data,
  height = 288,
  colors,
  variant = 'default',
}: {
  data: { name: string; value: number }[]
  height?: number
  colors?: string[]
  variant?: 'default' | 'analytics'
}) {
  const palette = colors ?? COLORS
  const isAnalytics = variant === 'analytics'
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined)

  return (
    <div
      className="w-full shrink-0 overflow-hidden"
      style={{ height, minHeight: height, maxHeight: height }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Pie
            dataKey="value"
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={isAnalytics ? '34%' : 60}
            outerRadius={isAnalytics ? '84%' : 90}
            paddingAngle={isAnalytics ? 4 : 0}
            isAnimationActive={isAnalytics}
            animationDuration={1200}
            animationEasing="ease-out"
            stroke={isAnalytics ? '#ffffff' : 'none'}
            strokeWidth={isAnalytics ? 3 : 0}
            activeIndex={activeIndex}
            activeShape={isAnalytics ? renderActiveShape : undefined}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(undefined)}
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={palette[i % palette.length]}
                style={
                  isAnalytics
                    ? {
                        filter:
                          activeIndex === i
                            ? 'drop-shadow(0 4px 10px rgba(6, 192, 51, 0.3))'
                            : 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.08))',
                        transition: 'filter 0.2s ease',
                      }
                    : undefined
                }
              />
            ))}
          </Pie>
          <Tooltip
            content={isAnalytics ? <CourseCompletionTooltip /> : undefined}
            contentStyle={
              isAnalytics
                ? undefined
                : {
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    border: '1px solid rgba(20, 83, 45, 0.2)',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 600,
                    boxShadow: '0 8px 24px rgba(20, 83, 45, 0.12)',
                    padding: '10px 14px',
                  }
            }
            formatter={isAnalytics ? undefined : (value: number, name: string) => [`${value}%`, name]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
