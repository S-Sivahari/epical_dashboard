import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function WeeklyHoursTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  const hours = Number(payload[0]?.value ?? 0)

  return (
    <div className="emp-weekly-hours-tooltip">
      <span className="emp-weekly-hours-tooltip__pattern" aria-hidden />
      <span className="emp-weekly-hours-tooltip__sheen" aria-hidden />
      <div className="emp-weekly-hours-tooltip__content">
        <p className="emp-weekly-hours-tooltip__label">{label}</p>
        <p className="emp-weekly-hours-tooltip__value">{hours.toFixed(1)}h</p>
        <p className="emp-weekly-hours-tooltip__meta">hours logged</p>
      </div>
    </div>
  )
}

export function TimesheetWeeklyChart({ data, height = 280 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 12, right: 24, left: 4, bottom: 8 }} barCategoryGap="20%">
        <defs>
          <linearGradient id="empWeeklyBarHover" x1="0" y1="1" x2="0.35" y2="0">
            <stop offset="0%" stopColor="#1b4332" />
            <stop offset="45%" stopColor="#2d6a4f" />
            <stop offset="100%" stopColor="#40916c" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(38, 107, 28, 0.1)" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 12, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', fill: '#475569' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          width={44}
          tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, ui-monospace, monospace', fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          content={<WeeklyHoursTooltip />}
          cursor={{ fill: 'rgba(27, 67, 50, 0.14)', radius: 8 }}
          wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}
          contentStyle={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}
        />
        <Bar
          dataKey="hours"
          fill="#266b1c"
          radius={[6, 6, 0, 0]}
          maxBarSize={56}
          activeBar={{
            fill: 'url(#empWeeklyBarHover)',
            stroke: '#1b4332',
            strokeWidth: 1,
            radius: [6, 6, 0, 0],
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
