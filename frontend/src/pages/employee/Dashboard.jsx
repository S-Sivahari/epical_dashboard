import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Clock,
  CalendarOff,
  FolderKanban,
  ArrowRight,
  FileText,
  CalendarRange,
} from 'lucide-react'
import { ProfileCard } from '@components/employee/shared/ProfileCard'
import { LeaveCard } from '@components/employee/shared/LeaveCard'
import { AssignedProjectsSection } from '@components/employee/shared/AssignedProjectsSection'
import { AnnouncementBanner } from '@components/employee/shared/AnnouncementBanner'
import { UpcomingHolidaysCard } from '@components/employee/shared/UpcomingHolidaysCard'
import { RecentLeaveRequestsCard } from '@components/employee/shared/RecentLeaveRequestsCard'
import { useAuthStore } from '@store/authStore'
import { fetchEmployeeDashboard } from '@services/employeeDashboardService'
import * as leaveService from '@services/leaveService'
import { cn } from '@pages/employee/lib/utils'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'

const LEAVE_COLORS = {
  'Casual Leave': '#3d7a6a',
  'Sick Leave': '#4a7a9a',
  'Earned Leave': '#6b5b8a',
}

const LEAVE_TINT = {
  casual: 'emp-leave-tint--casual',
  sick: 'emp-leave-tint--sick',
  earned: 'emp-leave-tint--earned',
}

const CARD_CLASS = portalCardClass({ className: 'flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-5' })

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

function SectionCard({ title, subtitle, action, children, className = '', tone, icon: Icon }) {
  return (
    <InteractiveCard
      className={cn(CARD_CLASS, tone && `emp-dash-card emp-dash-card--${tone}`, className)}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {Icon ? (
            <div className={cn('emp-dash-icon', tone && `emp-dash-icon--${tone}`)} aria-hidden>
              <Icon className="h-4 w-4" />
            </div>
          ) : null}
          <div className="min-w-0">
            <h3 className="font-heading text-base font-semibold text-foreground">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
          </div>
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

export default function Dashboard() {
  const employee = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState(true)
  const [balancesLoading, setBalancesLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [balances, setBalances] = useState(() => formatLeaveBalances())
  const [leaves, setLeaves] = useState([])
  const [leaveHistory, setLeaveHistory] = useState([])
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
        setLeaveHistory(
          Array.isArray(data.leaveHistory)
            ? data.leaveHistory
            : Array.isArray(data.leaves)
              ? data.leaves
              : [],
        )
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

  const widgetSkeleton = <InlineSkeleton className="min-h-[280px] h-full" />

  const profileStats = useMemo(
    () => [
      {
        title: 'Hours This Month',
        value: `${monthlyHours}h`,
        icon: Clock,
        trend: `${weeklyHours}h this week`,
        accent: 'teal',
      },
      {
        title: 'Pending Leave',
        value: String(pendingLeaves.length),
        icon: CalendarOff,
        trend: pendingLeaves.length ? 'Awaiting approval' : 'None pending',
        accent: 'amber',
      },
      {
        title: 'Active Projects',
        value: String(projectCount),
        icon: FolderKanban,
        trend: projectCount ? 'Assigned to you' : 'None assigned',
        accent: 'blue',
      },
      {
        title: 'Training',
        value: String(completedCourses),
        icon: BookOpen,
        trend: enrolledCourses > 0 ? `${enrolledCourses} in progress` : 'No enrollments',
        accent: 'violet',
      },
    ],
    [
      monthlyHours,
      weeklyHours,
      pendingLeaves.length,
      projectCount,
      completedCourses,
      enrolledCourses,
    ],
  )

  return (
    <div className="relative max-w-full pb-8" data-employee-dashboard data-page-scrollable>
      <div className="dashboard-shell max-w-full space-y-4 overflow-x-hidden">
      <div className="space-y-3">
        <AnnouncementBanner compact />

        <div className="overflow-x-auto pb-0.5">
          <ProfileCard
            employee={employee}
            profile={profile}
            attendance={attendance}
            horizontal
            stats={loading ? null : profileStats}
            statsLoading={loading}
            className="min-w-[36rem] sm:min-w-0"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-stretch">
        {balancesLoading ? (
          widgetSkeleton
        ) : (
          <SectionCard
            className="h-full"
            tone="sage"
            icon={CalendarRange}
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
                  color={lb.color ?? LEAVE_COLORS[lb.type] ?? '#3d7a6a'}
                  embedded
                  tintClass={LEAVE_TINT[lb.key]}
                  className="h-full min-h-0 py-3"
                />
              ))}
            </div>
          </SectionCard>
        )}

        {loading ? (
          widgetSkeleton
        ) : (
          <RecentLeaveRequestsCard
            className="h-full emp-dash-card emp-dash-card--amber"
            leaves={leaveHistory.length ? leaveHistory : leaves}
          />
        )}

        {loading ? (
          widgetSkeleton
        ) : (
          <UpcomingHolidaysCard className="h-full emp-dash-card emp-dash-card--sky" holidays={holidays} />
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
        className="emp-dash-card emp-dash-card--violet"
        initialProjects={assignedProjects}
        loading={loading && assignedProjects == null}
      />
      </div>
    </div>
  )
}
