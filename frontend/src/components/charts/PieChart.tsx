import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const COLORS = ['#16a34a', '#3b82f6', '#f59e0b', '#a855f7', '#64748b']

const tooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  color: '#0f172a',
  fontSize: 12,
}

export function DepartmentPieChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie dataKey="value" data={data} innerRadius={60} outerRadius={90} paddingAngle={3} isAnimationActive>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
