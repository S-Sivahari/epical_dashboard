import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Clock,
  CalendarOff,
  FolderKanban,
  ArrowRight,
  LogIn,
  LogOut,
  Calendar,
} from 'lucide-react'
import { ProfileCard } from '@components/employee/shared/ProfileCard'
import { KPIStatCard } from '@components/employee/shared/KPIStatCard'
import { LeaveCard } from '@components/employee/shared/LeaveCard'
import { AssignedProjectsSection } from '@components/employee/shared/AssignedProjectsSection'
import { Badge, statusVariant } from '@components/employee/ui/badge'
import { Progress } from '@components/employee/ui/progress'
import { useAuthStore } from '@store/authStore'
import { fetchEmployeeDashboard } from '@services/employeeDashboardService'
import * as leaveService from '@services/leaveService'
import { formatDate } from '@pages/employee/lib/utils'

const LEAVE_COLORS = {
  'Casual Leave': '#16a34a',
  'Sick Leave': '#3b82f6',
  'Earned Leave': '#8b5cf6',
}

function formatLeaveBalances(balanceData = {}) {
  return [
    {
      key: 'casual',
      type: 'Casual Leave',
      used: balanceData['Casual Leave']?.used ?? 0,
      total: balanceData['Casual Leave']?.total ?? 12,
      remaining: balanceData['Casual Leave']?.remaining ?? 12,
      color: LEAVE_COLORS['Casual Leave'],
    },
    {
      key: 'sick',
      type: 'Sick Leave',
      used: balanceData['Sick Leave']?.used ?? 0,
      total: balanceData['Sick Leave']?.total ?? 12,
      remaining: balanceData['Sick Leave']?.remaining ?? 12,
      color: LEAVE_COLORS['Sick Leave'],
    },
    {
      key: 'earned',
      type: 'Earned Leave',
      used: balanceData['Earned Leave']?.used ?? 0,
      total: balanceData['Earned Leave']?.total ?? 0,
      remaining: balanceData['Earned Leave']?.remaining ?? 0,
      color: LEAVE_COLORS['Earned Leave'],
    },
  ]
}

function SectionCard({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 shadow-card md:p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-semibold text-foreground">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function InlineSkeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />
}

export default function Dashboard() {
  const employee = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState(true)
  const [balancesLoading, setBalancesLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [balances, setBalances] = useState(() => formatLeaveBalances())
  const [leaves, setLeaves] = useState([])
  const [holidays, setHolidays] = useState([])
  const [documents, setDocuments] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [attendance, setAttendance] = useState(null)
  const [monthlyHours, setMonthlyHours] = useState(0)
  const [weeklyHours, setWeeklyHours] = useState(0)
  const [projectCount, setProjectCount] = useState(0)
  const [assignedProjects, setAssignedProjects] = useState(null)

  useEffect(() => {
    if (!employee?.id) return

    let cancelled = false
    setBalancesLoading(true)

    leaveService
      .getBalances()
      .then((data) => {
        if (!cancelled) setBalances(formatLeaveBalances(data))
      })
      .catch((error) => {
        console.error('[Dashboard] leave balances failed:', error)
        if (!cancelled) setBalances(formatLeaveBalances())
      })
      .finally(() => {
        if (!cancelled) setBalancesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [employee?.id])

  useEffect(() => {
    if (!employee?.id) return

    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const data = await fetchEmployeeDashboard()
        if (cancelled) return

        const balanceData = data.balances ?? {}
        const projects = Array.isArray(data.projects) ? data.projects : []

        setProfile(data.profile ?? null)
        setAssignedProjects(projects)
        setBalances(formatLeaveBalances(balanceData))
        setLeaves(Array.isArray(data.leaves) ? data.leaves : [])
        setHolidays(Array.isArray(data.holidays) ? data.holidays : [])
        setDocuments(Array.isArray(data.documents) ? data.documents : [])
        setEnrollments(Array.isArray(data.enrollments) ? data.enrollments : [])
        setAttendance(data.attendance ?? null)
        setMonthlyHours(Number(data.monthlyHours) || 0)
        setWeeklyHours(Number(data.weeklyHours) || 0)
        setProjectCount(projects.length)
      } catch (error) {
        console.error('[Dashboard] load failed:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [employee?.id])

  const pendingLeaves = useMemo(
    () => leaves.filter((l) => l.status === 'Pending'),
    [leaves],
  )

  const pendingDocs = useMemo(
    () => documents.filter((d) => d.status === 'Requested'),
    [documents],
  )

  const enrolledCourses = enrollments.filter((e) => e.status === 'Enrolled').length
  const completedCourses = enrollments.filter((e) => e.status === 'Completed').length

  const upcomingHolidays = useMemo(() => holidays.slice(0, 5), [holidays])

  const weeklyTarget = 40
  const weeklyProgress = Math.min(100, Math.round((weeklyHours / weeklyTarget) * 100))

  return (
    <div className="space-y-6">
      <ProfileCard employee={employee} profile={profile} attendance={attendance} />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <InlineSkeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KPIStatCard
            title="Hours This Month"
            value={`${monthlyHours}h`}
            icon={Clock}
            trend={`${weeklyHours}h logged this week`}
          />
          <KPIStatCard
            title="Pending Leave"
            value={String(pendingLeaves.length)}
            icon={CalendarOff}
            trend={pendingLeaves.length ? 'Awaiting approval' : 'No pending requests'}
          />
          <KPIStatCard
            title="Active Projects"
            value={String(projectCount)}
            icon={FolderKanban}
            trend={projectCount ? 'Assigned to you' : 'None assigned yet'}
          />
          <KPIStatCard
            title="Training"
            value={String(completedCourses)}
            icon={BookOpen}
            trend={
              enrolledCourses > 0
                ? `${enrolledCourses} course${enrolledCourses === 1 ? '' : 's'} in progress`
                : 'No active enrollments'
            }
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {balancesLoading ? (
            <InlineSkeleton className="h-64" />
          ) : (
            <SectionCard
              title="Leave Balance"
              subtitle="Your remaining leave for the year"
              action={
                <Link
                  to="/employee/leave"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Apply leave <ArrowRight className="h-4 w-4" />
                </Link>
              }
            >
              <div className="grid gap-3 sm:grid-cols-3">
                {balances.map((lb) => (
                  <LeaveCard
                    key={lb.key}
                    type={lb.type}
                    used={lb.used}
                    total={lb.total}
                    remaining={lb.remaining}
                    color={lb.color ?? LEAVE_COLORS[lb.type] ?? '#16a34a'}
                  />
                ))}
              </div>
            </SectionCard>
          )}

          {loading ? (
            <InlineSkeleton className="h-64" />
          ) : (
            <SectionCard
              title="Recent Leave Requests"
              subtitle="Latest activity on your leave applications"
              action={
                <Link
                  to="/employee/leave"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  View all <ArrowRight className="h-4 w-4" />
                </Link>
              }
            >
              {leaves.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
                  No leave requests yet.
                </p>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {leaves.slice(0, 5).map((leave) => (
                    <div key={leave.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{leave.type}</p>
                        <p className="text-sm text-muted">
                          {formatDate(leave.from)} – {formatDate(leave.to)} · {leave.days}{' '}
                          {leave.days === 1 ? 'day' : 'days'}
                        </p>
                      </div>
                      <Badge variant={statusVariant(leave.status)}>{leave.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}
        </div>

        <div className="space-y-6">
          {loading ? (
            <InlineSkeleton className="h-64" />
          ) : (
            <SectionCard title="Today's Attendance" subtitle="Quick status from timesheet">
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-sm text-muted">
                    <LogIn className="h-4 w-4 text-primary" /> Check-in
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {attendance?.checkInTime
                      ? new Date(attendance.checkInTime).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-sm text-muted">
                    <LogOut className="h-4 w-4 text-primary" /> Check-out
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {attendance?.checkOutTime
                      ? new Date(attendance.checkOutTime).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </span>
                </div>
                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-muted">Weekly hours</span>
                    <span className="font-semibold text-foreground">
                      {weeklyHours}h / {weeklyTarget}h
                    </span>
                  </div>
                  <Progress value={weeklyProgress} className="h-2.5" />
                </div>
                <Link
                  to="/employee/timesheet"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90"
                >
                  <Clock className="h-4 w-4" /> Open Timesheet
                </Link>
              </div>
            </SectionCard>
          )}

          {!loading && pendingDocs.length > 0 ? (
            <SectionCard
              title="Document Requests"
              subtitle={`${pendingDocs.length} pending`}
              action={
                <Link to="/employee/documents" className="text-sm font-medium text-primary hover:underline">
                  View
                </Link>
              }
            >
              <div className="space-y-2">
                {pendingDocs.slice(0, 3).map((doc) => (
                  <div key={doc.id} className="rounded-lg border border-border px-3 py-2.5">
                    <p className="text-sm font-medium text-foreground">{doc.documentName}</p>
                    <p className="text-xs text-muted">{doc.documentType}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}

          {loading ? (
            <InlineSkeleton className="h-48" />
          ) : (
            <SectionCard
              title="Upcoming Holidays"
              subtitle="Next dates on the company calendar"
              action={
                <Link
                  to="/employee/calendar"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Calendar <ArrowRight className="h-4 w-4" />
                </Link>
              }
            >
              {upcomingHolidays.length === 0 ? (
                <p className="text-sm text-muted">No upcoming holidays scheduled.</p>
              ) : (
                <ul className="space-y-2">
                  {upcomingHolidays.map((h) => (
                    <li
                      key={h.id ?? h.date}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Calendar className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate text-sm font-medium text-foreground">{h.title}</span>
                      </div>
                      <span className="shrink-0 text-xs text-muted">{formatDate(h.date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}
        </div>
      </div>

      <AssignedProjectsSection initialProjects={assignedProjects} loading={loading && assignedProjects == null} />
    </div>
  )
}
