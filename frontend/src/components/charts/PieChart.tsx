import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const COLORS = ['#16a34a', '#3b82f6', '#f59e0b', '#a855f7', '#64748b']

const tooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid rgba(20, 83, 45, 0.2)',
  borderRadius: 10,
  color: '#0f172a',
  fontSize: 12,
  fontWeight: 600,
  boxShadow: '0 8px 24px rgba(20, 83, 45, 0.12)',
}

export function DepartmentPieChart({
  data,
  height = 288,
  colors,
}: {
  data: { name: string; value: number }[]
  height?: number
  colors?: string[]
}) {
  const palette = colors ?? COLORS
  return (
    <div className="w-full shrink-0 overflow-hidden" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie dataKey="value" data={data} innerRadius={60} outerRadius={90} paddingAngle={3} isAnimationActive>
            {data.map((_, i) => (
              <Cell key={i} fill={palette[i % palette.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
