import { useId, useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { IndividualPerformance } from '@/services/analyticsService'
import { CalendarDays, Clock, TrendingUp, Umbrella } from 'lucide-react'

const GREEN = {
  primary: '#2f6b4f',
  dark: '#2f6b4f',
  medium: '#3a8a62',
  light: '#86EFAC',
  axis: '#64748b',
  grid: 'rgba(47, 107, 79, 0.12)',
}

function HoursTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="analytics-floating-tooltip">
      <span className="analytics-floating-tooltip-label">{label}</span>
      <span className="analytics-floating-tooltip-value">{payload[0].value} hrs logged</span>
    </div>
  )
}

function AttendanceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="analytics-floating-tooltip">
      <span className="analytics-floating-tooltip-label">{label}</span>
      <span className="analytics-floating-tooltip-value">{payload[0].value}% attendance</span>
    </div>
  )
}

function MiniKpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Clock
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="admin-analytics-mini-kpi">
      <div className="admin-analytics-mini-kpi-icon" style={{ color: accent ?? GREEN.primary }}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="admin-analytics-mini-kpi-label">{label}</p>
        <p className="admin-analytics-mini-kpi-value">{value}</p>
      </div>
    </div>
  )
}

export function IndividualPerformancePanel({
  performance,
  chartHeight = 240,
}: {
  performance: IndividualPerformance
  chartHeight?: number
}) {
  const gradId = useId().replace(/:/g, '')
  const { hoursTrend, attendanceTrend, attendance } = performance

  const hoursMax = useMemo(() => {
    const peak = hoursTrend.reduce((max, row) => Math.max(max, row.hours), 0)
    return Math.max(8, Math.ceil(peak * 1.2))
  }, [hoursTrend])

  return (
    <div className="admin-analytics-individual-grid">
      <div className="admin-analytics-mini-kpi-row">
        <MiniKpi icon={Clock} label="Hours Logged" value={`${attendance.hoursLogged} hrs`} />
        <MiniKpi
          icon={CalendarDays}
          label="Attendance"
          value={`${attendance.attendancePercentage}%`}
        />
        <MiniKpi icon={Umbrella} label="Leave Days" value={String(attendance.leaveDays)} />
        <MiniKpi
          icon={TrendingUp}
          label="Productivity"
          value={`${attendance.productivityScore}%`}
          accent={GREEN.dark}
        />
      </div>

      <div className="admin-analytics-individual-charts">
        <div className="admin-analytics-individual-chart-block">
          <h4 className="admin-analytics-individual-chart-label">Hours Trend</h4>
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <ComposedChart data={hoursTrend} margin={{ top: 20, right: 12, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id={`indHoursGrad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GREEN.light} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={GREEN.primary} stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GREEN.grid} vertical={false} strokeDasharray="4 4" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: GREEN.axis, fontSize: 11, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: GREEN.axis, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                  domain={[0, hoursMax]}
                  tickFormatter={(v) => `${v}h`}
                />
                <Tooltip content={<HoursTooltip />} />
                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke="none"
                  fill={`url(#indHoursGrad-${gradId})`}
                  isAnimationActive
                  animationDuration={1000}
                />
                <Line
                  type="monotone"
                  dataKey="hours"
                  stroke={GREEN.primary}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: GREEN.primary, stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive
                  animationDuration={1000}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="admin-analytics-individual-chart-block">
          <h4 className="admin-analytics-individual-chart-label">Attendance Trend</h4>
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <ComposedChart
                data={attendanceTrend}
                margin={{ top: 20, right: 12, left: 0, bottom: 4 }}
              >
                <CartesianGrid stroke={GREEN.grid} vertical={false} strokeDasharray="4 4" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: GREEN.axis, fontSize: 11, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: GREEN.axis, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<AttendanceTooltip />} />
                <Line
                  type="monotone"
                  dataKey="attendance"
                  stroke={GREEN.dark}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: GREEN.medium, stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: GREEN.primary }}
                  isAnimationActive
                  animationDuration={1000}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="admin-analytics-leave-summary">
        <div className="admin-analytics-leave-stat">
          <span>Present Days</span>
          <strong>{attendance.presentDays}</strong>
        </div>
        <div className="admin-analytics-leave-stat">
          <span>Leave Days</span>
          <strong>{attendance.leaveDays}</strong>
        </div>
        <div className="admin-analytics-leave-stat">
          <span>Working Days</span>
          <strong>{attendance.totalWorkingDays}</strong>
        </div>
        <div className="admin-analytics-leave-bar">
          <div
            className="admin-analytics-leave-bar-present"
            style={{
              width: `${
                attendance.totalWorkingDays > 0
                  ? (attendance.presentDays / attendance.totalWorkingDays) * 100
                  : 0
              }%`,
            }}
          />
          <div
            className="admin-analytics-leave-bar-leave"
            style={{
              width: `${
                attendance.totalWorkingDays > 0
                  ? (attendance.leaveDays / attendance.totalWorkingDays) * 100
                  : 0
              }%`,
            }}
          />
        </div>
        <p className="admin-analytics-leave-caption">
          Leave usage vs working days in selected period
        </p>
      </div>
    </div>
  )
}
