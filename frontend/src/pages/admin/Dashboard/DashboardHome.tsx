import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  ClipboardList,

  Users,
  Clock,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { HoursBarChart } from '@components/charts/BarChart'
import { KPICard } from '@components/charts/KPICard'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Badge } from '@components/ui/Badge'
import { Avatar } from '@components/ui/Avatar'
import { useAuthStore } from '@store/authStore'
import { useLeaves } from '@hooks/useLeaves'
import { formatDateTime } from '@/utils/formatDate'
import api from '@/services/api'
import { AdminNewsTicker } from '@components/admin/AdminNewsTicker'

const quickActionClass =
  'inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-3 text-center text-sm font-medium text-ink transition-ui hover:bg-surface'

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
        const fmt = (d: Date) =>
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

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
                ((new Date(t.logoutTime).getTime() -
                  new Date(t.loginTime).getTime()) /
                  3600000) *
                  10
              ) / 10
            : 0
      const d = new Date(t.loginTime)
      const key = dayNames[d.getDay()]
      byDay[key] = (byDay[key] || 0) + hours
    })

    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((name) => ({
      name,
      hours: Math.round((byDay[name] || 0) * 10) / 10,
    }))
  }, [timesheets])

  // Compute KPI values from real data
  const activeProjectsCount = projects.filter(
    (p: any) => p.status === 'Active'
  ).length
  const totalEmployeesWorking = employeeHours.length
  const activeTasksCount = timesheets.filter(
    (t: any) => !t.logoutTime
  ).length

  // Build activity feed from recent timesheets
  const activity = useMemo(() => {
    const recent = [...timesheets]
      .sort(
        (a: any, b: any) =>
          new Date(b.loginTime).getTime() - new Date(a.loginTime).getTime()
      )
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

  return (
    <PageWrapper>
      <PageHeader
        title=""
        subtitle="Operational snapshot across people, leaves, and work."
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard' }]} />}
      />

      <AdminNewsTicker />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border bg-surface/70 p-5 shadow-sm lg:col-span-2"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={user?.name ?? 'Admin'} size="lg" />
              <div>
                <p className="font-display text-lg font-semibold text-ink">Welcome, {user?.name}</p>
                <p className="text-sm text-muted">
                  {user?.designation} · Joined {user?.joinedAt}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Link to="/admin/employees/add" className={quickActionClass}>
              Add Employee
            </Link>
            <Link to="/admin/leaves" className={quickActionClass}>
              Review Leaves
            </Link>
            <Link to="/admin/documents" className={quickActionClass}>
              Approve Documents
            </Link>
            <Link to="/admin/news" className={quickActionClass}>
              Manage News
            </Link>
          </div>
        </motion.section>
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-border bg-white p-5 shadow-sm"
        >
          <p className="text-sm font-semibold text-ink">Today</p>
          <p className="mt-2 text-sm text-muted">
            {loading
              ? 'Loading dashboard data…'
              : `${pendingLeavesCount} leave${pendingLeavesCount !== 1 ? 's' : ''} pending approval. ${activeTasksCount} active task${activeTasksCount !== 1 ? 's' : ''} running now.`}
          </p>
        </motion.section>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KPICard
          title="Employees Working"
          value={totalEmployeesWorking}
          trend={{
            direction: totalEmployeesWorking > 0 ? 'up' : 'down',
            label: 'This week',
          }}
          icon={Users}
        />
        <KPICard
          title="Pending Leaves"
          value={pendingLeavesCount}
          trend={{
            direction: pendingLeavesCount > 3 ? 'up' : 'down',
            label: 'Real-time updates',
          }}
          icon={ClipboardList}
          color="#f59e0b"
        />
        <KPICard
          title="Active Projects"
          value={activeProjectsCount}
          trend={{ direction: 'up', label: 'From projects DB' }}
          icon={Briefcase}
          color="#3b82f6"
        />
        <KPICard
          title="Active Tasks"
          value={activeTasksCount}
          trend={{
            direction: activeTasksCount > 0 ? 'up' : 'down',
            label: 'Running now',
          }}
          icon={Clock}
          color="#10b981"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm lg:col-span-2">
          <p className="font-display text-sm font-semibold text-ink">Weekly project hours</p>
          <HoursBarChart data={weeklyHours} />
        </div>
      </div>

      <section className="mt-6 rounded-xl border border-border bg-white p-5 shadow-sm">
        <div className="mb-4 border-b border-border pb-4">
          <h2 className="font-display text-lg font-semibold text-ink">Activity</h2>
          <p className="mt-1 text-sm text-muted">Latest work sessions from employees</p>
        </div>
        {activity.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">
            No recent timesheet activity this week.
          </p>
        ) : (
          <ul className="space-y-3">
            {activity.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface/40 px-3 py-2">
                <div>
                  <Badge variant={a.type === 'Active Task' ? 'warning' : 'info'} className="mb-1">
                    {a.type}
                  </Badge>
                  <p className="text-sm text-ink">{a.text}</p>
                </div>
                <span className="text-xs text-muted">{formatDateTime(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageWrapper>
  )
}
