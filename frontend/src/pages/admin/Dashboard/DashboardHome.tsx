import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  ClipboardList,
  Users,
  Clock,
  Newspaper,
  UserPlus,
  FileText,
  Sparkles,
  ChevronRight,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { HoursBarChart } from '@components/charts/BarChart'
import { KPICard } from '@components/charts/KPICard'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Badge } from '@components/ui/Badge'
import { Avatar } from '@components/ui/Avatar'
import { useAuthStore } from '@store/authStore'
import { useLeaves } from '@hooks/useLeaves'
import { formatDateTime } from '@/utils/formatDate'
import api from '@/services/api'
import { AdminNewsTicker } from '@components/admin/AdminNewsTicker'
import { ROUTES } from '@constants/routes'
import { cn } from '@/utils/cn'

const cardShell =
  'rounded-2xl border border-emerald-100/60 bg-white shadow-[0_6px_20px_-12px_rgba(15,118,110,0.14)]'

const quickLinkClass =
  'inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-emerald-200/80 bg-white px-2 text-center text-[12px] font-semibold text-emerald-900 transition-ui hover:border-emerald-300 hover:bg-emerald-50/90 hover:shadow-sm sm:h-9'

export function DashboardHome() {
  const user = useAuthStore((s) => s.user)
  const { leaves } = useLeaves()

  // Live data state
  const [timesheets, setTimesheets] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [employeeHours, setEmployeeHours] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch real data from the backend
  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true)
        // Build date range for this week (Mon–Sun)
        const now = new Date()
        const day = now.getDay()
        const diffToMon = day === 0 ? -6 : 1 - day
        const monday = new Date(now)
        monday.setDate(now.getDate() + diffToMon)
        monday.setHours(0, 0, 0, 0)
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)

        const pad = (n: number) => String(n).padStart(2, '0')
        const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

        const weekParams = { from: fmt(monday), to: fmt(sunday) }

        const [tsRes, projRes, empHoursRes] = await Promise.all([
          api.get('/timesheets', { params: weekParams }),
          api.get('/projects'),
          api.get('/timesheets/employee-hours', { params: weekParams }),
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
  }, [])

  // Calculate real-time statistics
  const pendingLeavesCount = leaves.filter((l) => l.status === 'Pending').length

  // Compute weekly hours by day from real timesheet data
  const weeklyHours = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const byDay: Record<string, number> = {}

    timesheets.forEach((t: any) => {
      if (!t.loginTime) return
      const hours =
        t.overriddenHours != null
          ? Number(t.overriddenHours)
          : t.logoutTime
            ? Math.round(
                ((new Date(t.logoutTime).getTime() - new Date(t.loginTime).getTime()) / 3600000) *
                  10,
              ) / 10
            : 0
      const d = new Date(t.loginTime)
      const key = dayNames[d.getDay()]
      byDay[key] = (byDay[key] || 0) + hours
    })

    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((name) => ({
      name,
      hours: Math.round((byDay[name] || 0) * 10) / 10,
    }))
  }, [timesheets])

  // Compute KPI values from real data
  const activeProjectsCount = projects.filter((p: any) => p.status === 'Active').length
  const totalEmployeesWorking = employeeHours.length
  const activeTasksCount = timesheets.filter((t: any) => !t.logoutTime).length

  // Build activity feed from recent timesheets
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

  const totalWeeklyHours = useMemo(
    () => Math.round(weeklyHours.reduce((s, d) => s + d.hours, 0) * 100) / 100,
    [weeklyHours],
  )

  return (
    <PageWrapper className="py-3">
      <div className="space-y-4">
        <AdminNewsTicker />

        <div className="grid gap-3 lg:grid-cols-3">
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(cardShell, 'p-3.5 md:p-4 lg:col-span-2')}
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Avatar name={user?.name ?? 'Admin'} src={user?.avatarUrl} size="lg" />
                <div>
                  <p className="font-display text-xl font-semibold tracking-tight text-slate-900">
                    Welcome back, {user?.name?.split(' ')[0] ?? 'Admin'}!
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {user?.designation}
                    {user?.joinedAt ? ` · Joined ${user.joinedAt}` : null}
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 sm:h-12 sm:w-12">
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
              </div>
            </div>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
              <Link to={ROUTES.EMPLOYEE_ADD} className={quickLinkClass}>
                <UserPlus className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.25} />
                Add Employee
              </Link>
              <Link to={ROUTES.LEAVES} className={quickLinkClass}>
                <ClipboardList className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.25} />
                Review Leaves
              </Link>
              <Link to={ROUTES.DOCUMENTS} className={quickLinkClass}>
                <FileText className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.25} />
                Document Requests
              </Link>
              <Link to={ROUTES.NEWS} className={quickLinkClass}>
                <Newspaper className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.25} />
                Manage News
              </Link>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className={cn(cardShell, 'flex flex-col p-3.5 md:p-4')}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-800/45">
              Today
            </p>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
              {loading ? (
                'Loading dashboard data…'
              ) : (
                <>
                  <span className="font-semibold text-slate-900">{pendingLeavesCount}</span> leave
                  {pendingLeavesCount !== 1 ? 's' : ''} pending approval.{' '}
                  <span className="font-semibold text-slate-900">{activeTasksCount}</span> active
                  task
                  {activeTasksCount !== 1 ? 's' : ''} running now.
                </>
              )}
            </p>
            <Link
              to={ROUTES.PROJECTS}
              className="group mt-auto flex items-center gap-1 pt-4 text-sm font-semibold text-emerald-700 transition-ui hover:text-emerald-800"
            >
              View all tasks
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.section>
        </div>

        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          <KPICard
            title="Employees Working"
            value={totalEmployeesWorking}
            trend={{
              direction: totalEmployeesWorking > 0 ? 'up' : 'down',
              label: 'This week',
            }}
            icon={Users}
            color="#059669"
          />
          <KPICard
            title="Pending Leaves"
            value={pendingLeavesCount}
            trend={{
              direction: pendingLeavesCount > 3 ? 'up' : 'down',
              label: pendingLeavesCount > 3 ? 'Needs attention' : 'Healthy load',
            }}
            icon={ClipboardList}
            color="#10b981"
          />
          <KPICard
            title="Active Projects"
            value={activeProjectsCount}
            trend={{ direction: 'up', label: 'Live from projects' }}
            icon={Briefcase}
            color="#047857"
          />
          <KPICard
            title="Active Tasks"
            value={activeTasksCount}
            trend={{
              direction: activeTasksCount > 0 ? 'up' : 'down',
              label: activeTasksCount > 0 ? 'Running now' : 'None active',
            }}
            icon={Clock}
            color="#0f766e"
          />
        </div>

        <div className={cn(cardShell, 'overflow-hidden p-3.5 md:p-4')}>
          <div className="mb-1 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Weekly project hours
              </h2>
              <p className="mt-1 text-sm text-slate-500">Hours logged this week (Mon–Sun)</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-4">
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Total hours
                </p>
                <p className="font-display text-2xl font-semibold tabular-nums text-emerald-800">
                  {loading ? '—' : `${totalWeeklyHours}`}
                  {!loading ? (
                    <span className="text-base font-semibold text-slate-400"> h</span>
                  ) : null}
                </p>
              </div>
              <span className="rounded-full border border-emerald-200/90 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-900">
                This Week
              </span>
            </div>
          </div>
          <div className="mt-2.5">
            <HoursBarChart data={weeklyHours} />
          </div>
        </div>

        <section className={cn(cardShell, 'p-3.5 md:p-4')}>
          <div className="mb-3.5 border-b border-emerald-100/80 pb-3">
            <h2 className="font-display text-lg font-semibold text-slate-900">Activity</h2>
            <p className="mt-1 text-sm text-slate-500">Latest work sessions from employees</p>
          </div>
          {activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No recent timesheet activity this week.
            </p>
          ) : (
            <ul className="space-y-3">
              {activity.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-emerald-100/60 bg-emerald-50/25 px-4 py-3"
                >
                  <div>
                    <Badge
                      variant={a.type === 'Active Task' ? 'warning' : 'info'}
                      className="mb-1.5"
                    >
                      {a.type}
                    </Badge>
                    <p className="text-sm text-slate-800">{a.text}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{formatDateTime(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageWrapper>
  )
}
