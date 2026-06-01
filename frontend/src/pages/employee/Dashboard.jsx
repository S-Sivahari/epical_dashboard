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
  FileText,
} from 'lucide-react'
import { ProfileCard } from '@components/employee/shared/ProfileCard'
import { KPIStatCard } from '@components/employee/shared/KPIStatCard'
import { LeaveCard } from '@components/employee/shared/LeaveCard'
import { AssignedProjectsSection } from '@components/employee/shared/AssignedProjectsSection'
import { AnnouncementBanner } from '@components/employee/shared/AnnouncementBanner'
import { Badge, statusVariant } from '@components/employee/ui/badge'
import { Progress } from '@components/employee/ui/progress'
import { useAuthStore } from '@store/authStore'
import { fetchEmployeeDashboard } from '@services/employeeDashboardService'
import * as leaveService from '@services/leaveService'
import { formatDate } from '@pages/employee/lib/utils'
import { cn } from '@pages/employee/lib/utils'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'

const LEAVE_COLORS = {
  'Casual Leave': '#16a34a',
  'Sick Leave': '#3b82f6',
  'Earned Leave': '#8b5cf6',
}

const CARD_CLASS = portalCardClass({ className: 'flex h-full flex-col p-4 sm:p-5' })

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
    <InteractiveCard className={cn(CARD_CLASS, className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
        <div className="min-w-0">
          <h3 className="font-heading text-base font-semibold text-foreground">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </InteractiveCard>
  )
}

function SectionLink({ to, label }) {
  return (
    <Link
      to={to}
      className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      {label} <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  )
}

function InlineSkeleton({ className = '' }) {
  return <div className={cn('animate-pulse rounded-xl bg-slate-100', className)} />
}

function EmptyState({ children }) {
  return (
    <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted">
      {children}
    </p>
  )
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

  const pendingLeaves = useMemo(() => leaves.filter((l) => l.status === 'Pending'), [leaves])
  const pendingDocs = useMemo(() => documents.filter((d) => d.status === 'Requested'), [documents])
  const enrolledCourses = enrollments.filter((e) => e.status === 'Enrolled').length
  const completedCourses = enrollments.filter((e) => e.status === 'Completed').length
  const upcomingHolidays = useMemo(() => holidays.slice(0, 4), [holidays])
  const recentLeaves = useMemo(() => leaves.slice(0, 4), [leaves])

  const weeklyTarget = 40
  const weeklyProgress = Math.min(100, Math.round((weeklyHours / weeklyTarget) * 100))

  const widgetSkeleton = <InlineSkeleton className="min-h-[220px] h-full" />

  return (
    <div className="max-w-full space-y-4 overflow-x-hidden">
      <AnnouncementBanner compact />

      <ProfileCard employee={employee} profile={profile} attendance={attendance} compact />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <InlineSkeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KPIStatCard
            className="p-4"
            title="Hours This Month"
            value={`${monthlyHours}h`}
            icon={Clock}
            trend={`${weeklyHours}h this week`}
          />
          <KPIStatCard
            className="p-4"
            title="Pending Leave"
            value={String(pendingLeaves.length)}
            icon={CalendarOff}
            trend={pendingLeaves.length ? 'Awaiting approval' : 'None pending'}
          />
          <KPIStatCard
            className="p-4"
            title="Active Projects"
            value={String(projectCount)}
            icon={FolderKanban}
            trend={projectCount ? 'Assigned to you' : 'None assigned'}
          />
          <KPIStatCard
            className="p-4"
            title="Training"
            value={String(completedCourses)}
            icon={BookOpen}
            trend={
              enrolledCourses > 0
                ? `${enrolledCourses} in progress`
                : 'No enrollments'
            }
          />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
        {balancesLoading ? (
          widgetSkeleton
        ) : (
          <SectionCard
            title="Leave balance"
            subtitle="Remaining leave for the year"
            action={<SectionLink to="/employee/leave" label="Apply" />}
          >
            <div className="grid flex-1 auto-rows-fr gap-2">
              {balances.map((lb) => (
                <LeaveCard
                  key={lb.key}
                  type={lb.type}
                  used={lb.used}
                  total={lb.total}
                  remaining={lb.remaining}
                  color={lb.color ?? LEAVE_COLORS[lb.type] ?? '#16a34a'}
                  embedded
                  className="h-full min-h-0 py-3"
                />
              ))}
            </div>
          </SectionCard>
        )}

        {loading ? (
          widgetSkeleton
        ) : (
          <SectionCard
            title="Recent leave requests"
            subtitle="Latest applications"
            action={<SectionLink to="/employee/leave" label="View all" />}
          >
            {recentLeaves.length === 0 ? (
              <EmptyState>No leave requests yet.</EmptyState>
            ) : (
              <ul className="flex flex-1 flex-col divide-y divide-border rounded-lg border border-border">
                {recentLeaves.map((leave) => (
                  <li
                    key={leave.id}
                    className="flex items-center justify-between gap-2 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{leave.type}</p>
                      <p className="truncate text-xs text-muted">
                        {formatDate(leave.from)} – {formatDate(leave.to)} · {leave.days}d
                      </p>
                    </div>
                    <Badge variant={statusVariant(leave.status)} className="shrink-0 text-[10px]">
                      {leave.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        {loading ? (
          widgetSkeleton
        ) : (
          <SectionCard title="Today's attendance" subtitle="Timesheet snapshot">
            <div className="flex flex-1 flex-col gap-2.5">
              <div className="flex items-center justify-between rounded-lg bg-slate-50/90 px-3 py-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                  <LogIn className="h-3.5 w-3.5 text-primary" /> Check-in
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {attendance?.checkInTime
                    ? new Date(attendance.checkInTime).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50/90 px-3 py-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                  <LogOut className="h-3.5 w-3.5 text-primary" /> Check-out
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {attendance?.checkOutTime
                    ? new Date(attendance.checkOutTime).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </span>
              </div>
              <div className="mt-auto">
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="text-muted">Weekly hours</span>
                  <span className="font-semibold text-foreground">
                    {weeklyHours}h / {weeklyTarget}h
                  </span>
                </div>
                <Progress value={weeklyProgress} className="h-2" />
              </div>
              <Link
                to="/employee/timesheet"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary/90"
              >
                <Clock className="h-3.5 w-3.5" /> Open timesheet
              </Link>
            </div>
          </SectionCard>
        )}

        {loading ? (
          widgetSkeleton
        ) : (
          <SectionCard
            title="Upcoming holidays"
            subtitle="Company calendar"
            action={<SectionLink to="/employee/calendar" label="Calendar" />}
          >
            {upcomingHolidays.length === 0 ? (
              <EmptyState>No upcoming holidays.</EmptyState>
            ) : (
              <ul className="flex flex-1 flex-col gap-2">
                {upcomingHolidays.map((h) => (
                  <li
                    key={h.id ?? h.date}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate text-sm font-medium text-foreground">{h.title}</span>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted">{formatDate(h.date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}
      </div>

      {!loading && pendingDocs.length > 0 ? (
        <div
          data-portal-card=""
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-amber-300 hover:shadow-md"
        >
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-amber-700" />
            <p className="text-sm text-amber-900">
              <span className="font-medium">{pendingDocs.length}</span> document request
              {pendingDocs.length === 1 ? '' : 's'} pending HR review
            </p>
          </div>
          <Link to="/employee/documents" className="text-xs font-medium text-primary hover:underline">
            View documents
          </Link>
        </div>
      ) : null}

      <AssignedProjectsSection
        initialProjects={assignedProjects}
        loading={loading && assignedProjects == null}
      />
    </div>
  )
}
