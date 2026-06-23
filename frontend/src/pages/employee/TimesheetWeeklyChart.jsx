import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const CHART_BODY = (data) => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  const margin = isMobile 
    ? { top: 8, right: 16, left: 2, bottom: 24 }
    : { top: 12, right: 24, left: 4, bottom: 28 }
  
  return (
    <BarChart data={data} margin={margin} barCategoryGap="20%">
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
      <XAxis
        dataKey="day"
        tick={{ fontSize: 'clamp(0.6rem, 0.55rem + 0.25vw, 0.7rem)', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}
        axisLine={false}
        tickLine={false}
        tickMargin={6}
      />
      <YAxis
        width={isMobile ? 32 : 38}
        tick={{ fontSize: 'clamp(0.6rem, 0.55rem + 0.25vw, 0.7rem)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
        axisLine={false}
        tickLine={false}
        allowDecimals={false}
      />
      <Tooltip />
      <Bar dataKey="hours" fill="#266b1c" radius={[6, 6, 0, 0]} maxBarSize={56} />
    </BarChart>
  )
}

export function TimesheetWeeklyChart({ data, height, fill = false }) {
  if (fill) {
    return (
      <div className="emp-weekly-chart emp-weekly-chart--fill h-full w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {CHART_BODY(data)}
        </ResponsiveContainer>
      </div>
    )
  }

  const responsiveHeight = height || (typeof window !== 'undefined' && window.innerWidth < 640 ? 220 : 280)

  return (
    <ResponsiveContainer width="100%" height={responsiveHeight}>
      {CHART_BODY(data)}
    </ResponsiveContainer>
  )
}
