import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export function TimesheetWeeklyChart({ data, height = 280 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 12, right: 24, left: 4, bottom: 8 }} barCategoryGap="20%">
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 13 }} axisLine={false} tickLine={false} />
        <YAxis
          width={44}
          tick={{ fontSize: 13 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip />
        <Bar dataKey="hours" fill="#16a34a" radius={[6, 6, 0, 0]} maxBarSize={56} />
      </BarChart>
    </ResponsiveContainer>
  )
}
