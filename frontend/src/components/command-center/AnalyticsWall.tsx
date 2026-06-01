import { useState } from 'react'
import { ChevronDown, GripVertical, Maximize2, Minimize2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { HoursBarChart } from '@components/charts/BarChart'
import { GlassCard, SectionHeader, SkeletonBlock } from './shared'
import { CHART_PERIODS, getChartSubtitle, type ChartPeriod } from '@/pages/admin/Dashboard/dashboardChartUtils'
import { cn } from '@/utils/cn'
import { AnimatedCounter } from './AnimatedCounter'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface AnalyticsWallProps {
  loading: boolean
  chartData: { name: string; hours: number }[]
  chartPeriod: ChartPeriod
  onPeriodChange: (p: ChartPeriod) => void
  totalPeriodHours: number
  departmentStats: { name: string; employeeCount: number; attendanceRate: number }[]
  pendingLeavesCount: number
}

const LEAVE_COLORS = ['#266b1c', '#266b1c', '#2f7d24', '#266b1c']

export function AnalyticsWall({
  loading,
  chartData,
  chartPeriod,
  onPeriodChange,
  totalPeriodHours,
  departmentStats,
  pendingLeavesCount,
}: AnalyticsWallProps) {
  const [expanded, setExpanded] = useState<string | null>('attendance')
  const [periodOpen, setPeriodOpen] = useState(false)

  const leaveTrend = [
    { name: 'Approved', value: Math.max(1, 12 - pendingLeavesCount) },
    { name: 'Pending', value: pendingLeavesCount },
    { name: 'Upcoming', value: 4 },
  ]

  const cards = [
    { id: 'attendance', title: 'Attendance Analytics', span: 'lg:col-span-2 lg:row-span-2' },
    { id: 'payroll', title: 'Payroll Analytics', span: '' },
    { id: 'departments', title: 'Department Growth', span: '' },
    { id: 'leaves', title: 'Leave Trends', span: '' },
    { id: 'performance', title: 'Employee Performance', span: 'lg:col-span-2' },
  ]

  return (
    <section>
      <SectionHeader
        title="Analytics Wall"
        subtitle="Interactive metrics — expand, collapse, and explore"
        tone="blue"
        action={
          <span className="text-xs text-[var(--text-subtle)]">Drag widgets on dashboard to reorder</span>
        }
      />
      <div className="cmd-masonry grid grid-cols-1 gap-3 lg:grid-cols-3">
        {cards.map((card) => {
          const isExpanded = expanded === card.id
          return (
            <GlassCard
              key={card.id}
              padding="sm"
              hover={false}
              className={cn(
                'cmd-analytics-card',
                card.span,
                isExpanded && 'cmd-analytics-expanded ring-2 ring-[var(--green-200)]',
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 cursor-grab text-[var(--text-subtle)]" />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{card.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : card.id)}
                  className="cmd-bar-icon-btn !h-8 !w-8"
                >
                  {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
              </div>

              {loading ? (
                <SkeletonBlock className="h-40" />
              ) : (
                <AnimatePresence mode="wait">
                  {card.id === 'attendance' && (
                    <motion.div key="att" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="font-display text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                            <AnimatedCounter value={Math.round(totalPeriodHours)} suffix="h" />
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">{getChartSubtitle(chartPeriod)}</p>
                        </div>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setPeriodOpen(!periodOpen)}
                            className="cmd-period-btn flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                          >
                            {chartPeriod}
                            <ChevronDown className={cn('h-3 w-3 transition-transform', periodOpen && 'rotate-180')} />
                          </button>
                          {periodOpen && (
                            <div className="cmd-dropdown absolute right-0 z-10 mt-1 min-w-[140px] p-1">
                              {CHART_PERIODS.map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => { onPeriodChange(p); setPeriodOpen(false) }}
                                  className={cn('cmd-dropdown-item w-full', chartPeriod === p && 'cmd-dropdown-item-active')}
                                >
                                  {p}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={cn('transition-all', isExpanded ? 'h-64' : 'h-36')}>
                        <HoursBarChart data={chartData} theme="light" brand fillParent />
                      </div>
                    </motion.div>
                  )}
                  {card.id === 'payroll' && (
                    <motion.div key="pay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <div className="space-y-3">
                        {['Processed', 'Pending', 'Scheduled'].map((label, i) => (
                          <div key={label}>
                            <div className="mb-1 flex justify-between text-xs">
                              <span className="text-[var(--text-slate-blue)]">{label}</span>
                              <span className="font-semibold tabular-nums text-[var(--text-blue-dark)]">{[78, 12, 10][i]}%</span>
                            </div>
                            <div className="cmd-progress-track">
                              <motion.div
                                className="cmd-progress-fill"
                                initial={{ width: 0 }}
                                animate={{ width: `${[78, 12, 10][i]}%` }}
                                transition={{ delay: i * 0.1, duration: 0.8 }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                  {card.id === 'departments' && (
                    <motion.div key="dept" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={departmentStats.slice(0, 5)} layout="vertical" margin={{ left: 0, right: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(22, 163, 74, 0.08)" horizontal={false} />
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11, fill: '#3F6212' }} />
                          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(134, 239, 172, 0.45)', background: '#FFFFFF' }} />
                          <Bar dataKey="employeeCount" radius={[0, 6, 6, 0]} fill="#266b1c" />
                        </BarChart>
                      </ResponsiveContainer>
                    </motion.div>
                  )}
                  {card.id === 'leaves' && (
                    <motion.div key="leave" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={leaveTrend} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={4}>
                            {leaveTrend.map((_, i) => (
                              <Cell key={i} fill={LEAVE_COLORS[i % LEAVE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="mt-2 flex flex-wrap justify-center gap-3">
                        {leaveTrend.map((l, i) => (
                          <span key={l.name} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                            <span className="h-2 w-2 rounded-full" style={{ background: LEAVE_COLORS[i] }} />
                            {l.name}: {l.value}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  )}
                  {card.id === 'performance' && (
                    <motion.div key="perf" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {departmentStats.slice(0, 4).map((d) => (
                          <div key={d.name} className="cmd-mini-stat rounded-xl p-3 text-center">
                            <p className="text-lg font-bold text-[var(--text-green)]">{d.attendanceRate}%</p>
                            <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{d.name}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </GlassCard>
          )
        })}
      </div>
    </section>
  )
}
