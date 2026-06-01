import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  ClipboardList,
  Users,
  Newspaper,
  UserPlus,
  FileText,
  ChevronDown,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { HoursBarChart } from '@components/charts/BarChart'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Avatar } from '@components/ui/Avatar'
import { useAuthStore } from '@store/authStore'
import { useLeaves } from '@hooks/useLeaves'
import api from '@/services/api'
import { AdminNewsTicker } from '@components/admin/AdminNewsTicker'
import { ROUTES } from '@constants/routes'
import { cn } from '@/utils/cn'
import {
  aggregateChartData,
  CHART_PERIODS,
  type ChartPeriod,
  getChartRange,
  getChartSubtitle,
} from './dashboardChartUtils'

interface StatCard {
  label: string
  value: string | number
  sub: string
  trend: 'up' | 'down'
  icon: React.ReactNode
  iconBg: string
  iconColor: string
}

function StatCardTile({ card, delay }: { card: StatCard; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: 'easeOut' }}
      className="metric-card relative overflow-hidden"
    >
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            {card.label}
          </p>
          <p className="metric-value mt-1.5 font-display text-[28px] font-extrabold leading-none tracking-tight">
            {card.value}
          </p>
          <p
            className={cn(
              'mt-1.5 text-xs font-semibold',
              card.trend === 'up' ? 'metric-trend-up' : 'metric-trend-down',
            )}
          >
            {card.trend === 'up' ? '▲' : '▼'} {card.sub}
          </p>
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: card.iconBg, color: card.iconColor }}
        >
          {card.icon}
        </div>
      </div>
    </motion.div>
  )
}

export function DashboardHome() {
  const user = useAuthStore((s) => s.user)
  const { leaves } = useLeaves()

  const [timesheets, setTimesheets] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [employeeHours, setEmployeeHours] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('This Week')
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false)
  const periodMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (periodMenuRef.current && !periodMenuRef.current.contains(e.target as Node)) {
        setPeriodMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true)
        const { from, to } = getChartRange(chartPeriod)
        const [tsRes, projRes, empHoursRes] = await Promise.all([
          api.get('/timesheets', { params: { from, to } }),
          api.get('/projects'),
          api.get('/timesheets/employee-hours', { params: { from, to } }),
        ])
        setTimesheets(tsRes.data || [])
        setProjects(projRes.data || [])
        setEmployeeHours(empHoursRes.data || [])
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboardData()
  }, [chartPeriod])

  const pendingLeavesCount = leaves.filter((l) => l.status === 'Pending').length
  const chartData = useMemo(() => aggregateChartData(timesheets, chartPeriod), [timesheets, chartPeriod])
  const activeProjectsCount = projects.filter((p: any) => p.status === 'Active').length
  const totalEmployeesWorking = employeeHours.length

  const totalPeriodHours = useMemo(
    () => Math.round(chartData.reduce((s, d) => s + d.hours, 0) * 100) / 100,
    [chartData],
  )

  const selectPeriod = (period: ChartPeriod) => {
    setChartPeriod(period)
    setPeriodMenuOpen(false)
  }

  const statCards: StatCard[] = [
    {
      label: 'Employees Working',
      value: loading ? '—' : totalEmployeesWorking,
      sub: chartPeriod,
      trend: 'up',
      icon: <Users className="h-5 w-5" strokeWidth={2} />,
      iconBg: 'rgba(0, 229, 255, 0.12)',
      iconColor: '#00e5ff',
    },
    {
      label: 'Pending Leaves',
      value: pendingLeavesCount,
      sub: pendingLeavesCount > 3 ? 'Needs attention' : 'Healthy load',
      trend: pendingLeavesCount > 3 ? 'up' : 'down',
      icon: <ClipboardList className="h-5 w-5" strokeWidth={2} />,
      iconBg: 'rgba(255, 69, 58, 0.12)',
      iconColor: '#ff453a',
    },
    {
      label: 'Active Projects',
      value: loading ? '—' : activeProjectsCount,
      sub: 'Live from projects',
      trend: 'up',
      icon: <Briefcase className="h-5 w-5" strokeWidth={2} />,
      iconBg: 'rgba(0, 230, 118, 0.12)',
      iconColor: '#00e676',
    },
  ]

  return (
    <PageWrapper className="relative z-10 py-4 font-body">
      <div className="space-y-4">
        <AdminNewsTicker variant="brand" />

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="dashboard-card crewiq-dash-card p-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <Avatar
                name={user?.name ?? 'Admin'}
                src={user?.avatarUrl}
                size="lg"
                color="#00e676"
                className="!ring-0"
              />
              <div>
                <p className="font-display text-xl font-bold tracking-tight text-[var(--text-primary)]">
                  Welcome back, {user?.name?.split(' ')[0] ?? 'Admin'}!
                </p>
                <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                  {user?.designation}
                  {user?.joinedAt ? ` · Joined ${user.joinedAt}` : null}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Link to={ROUTES.EMPLOYEE_ADD} className="action-button-pill crewiq-quick-link">
              <UserPlus className="h-4 w-4 shrink-0 text-[var(--neon-cyan,#00e5ff)]" strokeWidth={2.25} />
              Add Employee
            </Link>
            <Link to={ROUTES.LEAVES} className="action-button-pill crewiq-quick-link">
              <ClipboardList className="h-4 w-4 shrink-0 text-[var(--neon-cyan,#00e5ff)]" strokeWidth={2.25} />
              Review Leaves
            </Link>
            <Link to={ROUTES.DOCUMENTS} className="action-button-pill crewiq-quick-link">
              <FileText className="h-4 w-4 shrink-0 text-[var(--neon-cyan,#00e5ff)]" strokeWidth={2.25} />
              Document Requests
            </Link>
            <Link to={ROUTES.NEWS} className="action-button-pill crewiq-quick-link">
              <Newspaper className="h-4 w-4 shrink-0 text-[var(--neon-cyan,#00e5ff)]" strokeWidth={2.25} />
              Manage News
            </Link>
          </div>
        </motion.section>

        <div className="bottom-grid">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="dashboard-card crewiq-dash-card flex min-h-[320px] flex-col p-5"
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-bold capitalize text-[var(--text-primary)]">Project hours</h2>
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">{getChartSubtitle(chartPeriod)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                    Total
                  </p>
                  <p className="font-display text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                    {loading ? '—' : totalPeriodHours}
                    {!loading && <span className="text-base font-semibold text-[var(--text-muted)]"> h</span>}
                  </p>
                </div>
                <div className="relative" ref={periodMenuRef}>
                  <button
                    type="button"
                    onClick={() => setPeriodMenuOpen((open) => !open)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card-hover)]"
                    aria-expanded={periodMenuOpen}
                    aria-haspopup="listbox"
                  >
                    {chartPeriod}
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 text-[var(--text-muted)] transition-transform',
                        periodMenuOpen && 'rotate-180',
                      )}
                    />
                  </button>
                  {periodMenuOpen && (
                    <ul
                      role="listbox"
                      className="dashboard-card crewiq-dash-card absolute right-0 z-20 mt-2 min-w-[11rem] overflow-hidden py-1"
                    >
                      {CHART_PERIODS.map((period) => (
                        <li key={period}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={chartPeriod === period}
                            onClick={() => selectPeriod(period)}
                            className={cn(
                              'flex w-full px-3 py-2 text-left text-sm transition-colors',
                              chartPeriod === period
                                ? 'bg-[rgba(0,229,255,0.1)] font-semibold text-[var(--neon-cyan,#00e5ff)]'
                                : 'text-[var(--text-secondary)] hover:bg-white/[0.03]',
                            )}
                          >
                            {period}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-3 flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <span className="h-2 w-2 rounded-full bg-[var(--neon-green,#00e676)]" />
                Logged Hours
              </span>
            </div>

            <HoursBarChart data={chartData} theme="dark" brand fillParent />
          </motion.section>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {statCards.map((card, i) => (
              <StatCardTile key={card.label} card={card} delay={0.05 + i * 0.06} />
            ))}
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
