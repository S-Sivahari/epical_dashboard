import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  ClipboardList,
  Users,
  Newspaper,
  UserPlus,
  FileText,
  Sparkles,
  ChevronDown,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { HoursBarChart } from '@components/charts/BarChart'
import { KPICard } from '@components/charts/KPICard'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Avatar } from '@components/ui/Avatar'
import { useAuthStore } from '@store/authStore'
import { useLeaves } from '@hooks/useLeaves'
import { formatDateTime } from '@/utils/formatDate'
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

const cardShell =
  'rounded-xl border border-zinc-700/50 bg-[#27272a] shadow-[0_6px_20px_-12px_rgba(0,0,0,0.4)]'

const quickLinkClass =
  'inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-zinc-600/50 bg-[#3f3f46] px-2 text-center text-[12px] font-semibold text-white transition-ui hover:border-[#4f8ef7] hover:bg-[#52525b] hover:shadow-sm sm:h-9'

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

  const chartData = useMemo(
    () => aggregateChartData(timesheets, chartPeriod),
    [timesheets, chartPeriod],
  )

  const activeProjectsCount = projects.filter((p: any) => p.status === 'Active').length
  const totalEmployeesWorking = employeeHours.length
  const activeTasksCount = timesheets.filter((t: any) => !t.logoutTime).length

  const activity = useMemo(() => {
    const recent = [...timesheets]
      .sort((a: any, b: any) => new Date(b.loginTime).getTime() - new Date(a.loginTime).getTime())
      .slice(0, 5)

    return recent.map((t: any, idx: number) => {
      const isActive = !t.logoutTime
      return {
        id: t.id || String(idx),
        type: isActive ? 'Active Task' : 'Completed',
        text: isActive
          ? `${t.employeeName} is working on ${t.project} — ${t.task || 'task'}`
          : `${t.employeeName} logged ${t.totalHours || 0}h on ${t.project}`,
        at: t.loginTime,
      }
    })
  }, [timesheets])

  const totalPeriodHours = useMemo(
    () => Math.round(chartData.reduce((s, d) => s + d.hours, 0) * 100) / 100,
    [chartData],
  )

  const selectPeriod = (period: ChartPeriod) => {
    setChartPeriod(period)
    setPeriodMenuOpen(false)
  }

  return (
    <PageWrapper className="py-3 font-body">
      <div className="space-y-4">
        <AdminNewsTicker />

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(cardShell, 'p-3.5 md:p-4')}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar name={user?.name ?? 'Admin'} src={user?.avatarUrl} size="lg" />
              <div>
                <p className="font-display text-xl font-semibold tracking-tight text-white">
                  Welcome back, {user?.name?.split(' ')[0] ?? 'Admin'}!
                </p>
                <p className="mt-0.5 text-sm text-[#8892a4]">
                  {user?.designation}
                  {user?.joinedAt ? ` · Joined ${user.joinedAt}` : null}
                </p>
                {!loading ? (
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8892a4]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      <span className="font-semibold text-white">{pendingLeavesCount}</span> leave
                      {pendingLeavesCount !== 1 ? 's' : ''} pending
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#4f8ef7]" />
                      <span className="font-semibold text-white">{activeTasksCount}</span> active
                      task{activeTasksCount !== 1 ? 's' : ''}
                    </span>
                  </p>
                ) : null}
              </div>
            </div>
            <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#3f3f46] text-emerald-400 sm:h-12 sm:w-12">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
            </div>
          </div>
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            <Link to={ROUTES.EMPLOYEE_ADD} className={quickLinkClass}>
              <UserPlus className="h-4 w-4 shrink-0 text-[#4f8ef7]" strokeWidth={2.25} />
              Add Employee
            </Link>
            <Link to={ROUTES.LEAVES} className={quickLinkClass}>
              <ClipboardList className="h-4 w-4 shrink-0 text-[#4f8ef7]" strokeWidth={2.25} />
              Review Leaves
            </Link>
            <Link to={ROUTES.DOCUMENTS} className={quickLinkClass}>
              <FileText className="h-4 w-4 shrink-0 text-[#4f8ef7]" strokeWidth={2.25} />
              Document Requests
            </Link>
            <Link to={ROUTES.NEWS} className={quickLinkClass}>
              <Newspaper className="h-4 w-4 shrink-0 text-[#4f8ef7]" strokeWidth={2.25} />
              Manage News
            </Link>
          </div>
        </motion.section>

        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_240px] xl:grid-cols-[minmax(0,1fr)_272px]">
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className={cn(cardShell, 'overflow-hidden p-3.5 md:p-4')}
          >
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-white">Project hours</h2>
                <p className="mt-0.5 text-sm text-[#8892a4]">{getChartSubtitle(chartPeriod)}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-3">
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8892a4]">
                    Total hours
                  </p>
                  <p className="font-display text-2xl font-semibold tabular-nums text-white">
                    {loading ? '—' : `${totalPeriodHours}`}
                    {!loading ? (
                      <span className="text-base font-semibold text-[#8892a4]"> h</span>
                    ) : null}
                  </p>
                </div>
                <div className="relative" ref={periodMenuRef}>
                  <button
                    type="button"
                    onClick={() => setPeriodMenuOpen((open) => !open)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#4f8ef7]/60 bg-[#3f3f46] px-3 py-1.5 text-[11px] font-semibold text-white transition-ui hover:border-[#4f8ef7] hover:bg-[#52525b]"
                    aria-expanded={periodMenuOpen}
                    aria-haspopup="listbox"
                  >
                    {chartPeriod}
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 text-[#8892a4] transition-transform',
                        periodMenuOpen && 'rotate-180',
                      )}
                    />
                  </button>
                  {periodMenuOpen ? (
                    <ul
                      role="listbox"
                      className="absolute right-0 z-20 mt-1.5 min-w-[10.5rem] overflow-hidden rounded-xl border border-zinc-700/50 bg-[#3f3f46] py-1 shadow-lg shadow-black/30"
                    >
                      {CHART_PERIODS.map((period) => (
                        <li key={period}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={chartPeriod === period}
                            onClick={() => selectPeriod(period)}
                            className={cn(
                              'flex w-full px-3 py-2 text-left text-sm transition-ui',
                              chartPeriod === period
                                ? 'bg-[rgba(79,142,247,0.15)] font-semibold text-[#4f8ef7]'
                                : 'text-[#cbd5e1] hover:bg-[#27272a]',
                            )}
                          >
                            {period}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-1">
              <HoursBarChart data={chartData} theme="dark" />
            </div>
          </motion.section>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="flex flex-col gap-2.5"
          >
            <KPICard
              title="Employees Working"
              value={loading ? '—' : totalEmployeesWorking}
              trend={{
                direction: totalEmployeesWorking > 0 ? 'up' : 'down',
                label: chartPeriod,
              }}
              icon={Users}
              color="#4f8ef7"
            />
            <KPICard
              title="Pending Leaves"
              value={pendingLeavesCount}
              trend={{
                direction: pendingLeavesCount > 3 ? 'up' : 'down',
                label: pendingLeavesCount > 3 ? 'Needs attention' : 'Healthy load',
              }}
              icon={ClipboardList}
              color="#f59e0b"
            />
            <KPICard
              title="Active Projects"
              value={loading ? '—' : activeProjectsCount}
              trend={{ direction: 'up', label: 'Live from projects' }}
              icon={Briefcase}
              color="#2ecc71"
            />
          </motion.div>
        </div>

        <section>
          <div className="mb-3.5">
            <h2 className="font-display text-lg font-semibold text-white">Activity</h2>
            <p className="mt-1 text-sm text-[#8892a4]">
              Latest work sessions for {chartPeriod.toLowerCase()}
            </p>
          </div>
          {activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#8892a4]">
              No recent timesheet activity for this period.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {activity.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-zinc-700/40 bg-[#27272a] px-4 py-3"
                >
                  <div>
                    <span
                      className={cn(
                        'mb-1.5 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                        a.type === 'Active Task'
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-[rgba(79,142,247,0.15)] text-[#4f8ef7]',
                      )}
                    >
                      {a.type}
                    </span>
                    <p className="text-sm text-white">{a.text}</p>
                  </div>
                  <span className="shrink-0 text-xs text-[#8892a4]">{formatDateTime(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageWrapper>
  )
}
