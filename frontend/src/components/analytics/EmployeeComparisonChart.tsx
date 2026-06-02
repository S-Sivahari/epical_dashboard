import { useEffect, useId, useMemo, useState } from 'react'
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
import { PaginationBar } from '@components/tables/Pagination'
import type { EmployeePerformanceRow, PerformanceTier } from '@/services/analyticsService'
import { cn } from '@/utils/cn'

const TABLE_PAGE_SIZE = 5

const GREEN = {
  primary: '#06C033',
  dark: '#065F46',
  medium: '#16A34A',
  light: '#86EFAC',
  top: '#064E3B',
  above: '#06C033',
  below: '#86EFAC',
}

const BAR_HEIGHT = 36
const CHART_PAD = 48

function tierColor(tier: PerformanceTier) {
  if (tier === 'top') return GREEN.top
  if (tier === 'above') return GREEN.above
  return GREEN.below
}

function tierLabel(tier: PerformanceTier) {
  if (tier === 'top') return 'Top Performer'
  if (tier === 'above') return 'Above Average'
  return 'Below Average'
}

function ComparisonTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: EmployeePerformanceRow }[]
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="analytics-comparison-tooltip">
      <p className="analytics-comparison-tooltip-name">{row.name}</p>
      <p className="analytics-comparison-tooltip-id">{row.employeeId}</p>
      <div className="analytics-comparison-tooltip-grid">
        <span>Hours</span>
        <strong>{row.totalHours} hrs</strong>
        <span>Attendance</span>
        <strong>{row.attendancePercent}%</strong>
        <span>Leave days</span>
        <strong>{row.leaveDays}</strong>
        <span>Working days</span>
        <strong>{row.totalWorkingDays}</strong>
      </div>
      <span className={cn('analytics-tier-badge', `is-${row.tier}`)}>{tierLabel(row.tier)}</span>
    </div>
  )
}

export function EmployeeComparisonChart({
  data,
  className,
}: {
  data: EmployeePerformanceRow[]
  className?: string
}) {
  const gradId = useId().replace(/:/g, '')
  const chartHeight = Math.max(280, data.length * BAR_HEIGHT + CHART_PAD)

  const xMax = useMemo(() => {
    const peak = data.reduce((max, row) => Math.max(max, row.totalHours), 0)
    return Math.max(8, Math.ceil(peak * 1.15))
  }, [data])

  return (
    <div
      className={cn('w-full shrink-0 overflow-hidden', className)}
      style={{ height: chartHeight, minHeight: chartHeight, maxHeight: chartHeight }}
    >
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 56, left: 8, bottom: 8 }}
          barCategoryGap="18%"
        >
          <defs>
            {(['top', 'above', 'below'] as PerformanceTier[]).map((tier) => (
              <linearGradient key={tier} id={`cmpGrad-${gradId}-${tier}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={tierColor(tier)} stopOpacity={0.85} />
                <stop offset="55%" stopColor={GREEN.medium} stopOpacity={0.95} />
                <stop offset="100%" stopColor={GREEN.primary} stopOpacity={1} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="rgba(6, 192, 51, 0.1)" horizontal={false} strokeDasharray="4 4" />
          <XAxis
            type="number"
            domain={[0, xMax]}
            tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}h`}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={128}
            tick={{ fill: '#0f172a', fontSize: 11, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ComparisonTooltip />} cursor={{ fill: 'rgba(6, 192, 51, 0.08)' }} />
          <Bar
            dataKey="totalHours"
            radius={[0, 8, 8, 0]}
            barSize={22}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
          >
            {data.map((row) => (
              <Cell key={row.id} fill={`url(#cmpGrad-${gradId}-${row.tier})`} />
            ))}
            <LabelList
              dataKey="totalHours"
              position="right"
              formatter={(v: number) => `${v} hrs`}
              fill="#065F46"
              fontSize={11}
              fontWeight={700}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function EmployeeComparisonTable({ data }: { data: EmployeePerformanceRow[] }) {
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [data])

  const pageRows = useMemo(() => {
    const start = (page - 1) * TABLE_PAGE_SIZE
    return data.slice(start, start + TABLE_PAGE_SIZE)
  }, [data, page])

  return (
    <div className="admin-analytics-comparison-table-section">
      <div className="admin-analytics-comparison-table-wrap">
        <table className="admin-analytics-comparison-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>ID</th>
              <th>Hours</th>
              <th>Working Days</th>
              <th>Attendance</th>
              <th>Leave</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.id}>
                <td className="font-semibold text-slate-900">{row.name}</td>
                <td className="text-slate-600">{row.employeeId}</td>
                <td className="tabular-nums font-bold text-[#065F46]">{row.totalHours} hrs</td>
                <td className="tabular-nums">{row.totalWorkingDays}</td>
                <td className="tabular-nums">{row.attendancePercent}%</td>
                <td className="tabular-nums">{row.leaveDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > TABLE_PAGE_SIZE && (
        <PaginationBar
          total={data.length}
          page={page}
          pageSize={TABLE_PAGE_SIZE}
          onPageChange={setPage}
          className="admin-analytics-comparison-pagination"
        />
      )}
    </div>
  )
}
