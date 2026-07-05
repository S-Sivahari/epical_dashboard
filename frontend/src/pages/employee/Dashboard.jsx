import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Clock,
  CalendarOff,
  FolderKanban,
  ArrowRight,
  CalendarRange,
} from 'lucide-react'
import { ProfileCard } from '@components/employee/shared/ProfileCard'
import { LeaveCard } from '@components/employee/shared/LeaveCard'
import { DashboardWorkInsights } from '@components/employee/shared/DashboardWorkInsights'
import { DashboardSessionPanel } from '@components/employee/shared/DashboardSessionPanel'
import { UpcomingHolidaysCard } from '@components/employee/shared/UpcomingHolidaysCard'
import { DashboardDocumentRequests } from '@components/employee/shared/DashboardDocumentRequests'
import { DashboardCalendarCard } from '@components/employee/shared/DashboardCalendarCard'
import { useAuthStore } from '@store/authStore'
import { fetchEmployeeDashboard } from '@services/employeeDashboardService'
import * as leaveService from '@services/leaveService'
import { formatLeaveBalances } from '@/utils/leaveBalances'
import { formatWorkedDuration } from '@utils/durationFormat'
import { useAttendanceWeeklyHours } from '@hooks/useAttendanceWeeklyHours'
import { cn } from '@pages/employee/lib/utils'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'

const CARD_CLASS = portalCardClass({ className: 'flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-5' })
const COMPACT_CARD_CLASS = portalCardClass({
  className: 'flex h-full min-h-0 flex-col overflow-hidden p-3',
})

function SectionCard({ title, subtitle, action, children, className = '', tone, icon: Icon, compact = false, to }) {
  const cardClass = compact ? COMPACT_CARD_CLASS : CARD_CLASS

  return (
    <InteractiveCard
      to={to}
      className={cn(cardClass, tone && `emp-dash-card emp-dash-card--${tone}`, className)}
    >
      <div
        className={cn(
          compact
            ? 'emp-dash-bottom-widget-header'
            : 'mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border pb-3',
        )}
      >
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          {Icon ? (
            <div
              className={cn(
                'emp-dash-icon shrink-0',
                tone && `emp-dash-icon--${tone}`,
                compact && 'h-7 w-7',
              )}
              aria-hidden
            >
              <Icon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
            </div>
          ) : null}
          <div className="min-w-0 overflow-hidden">
            <h3 className={cn('font-heading font-semibold text-foreground truncate', compact ? '' : 'text-base')}>
              {title}
            </h3>
            {subtitle ? <p className="mt-0.5 text-xs text-muted truncate">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="emp-dash-widget-body flex min-h-0 flex-1 flex-col">
        {children}
      </div>
    </InteractiveCard>
  )
}

function SectionLink({ to, label }) {
  return (
    <Link
      to={to}
      className="emp-dash-btn emp-dash-btn--sm inline-flex shrink-0 items-center gap-1"
    >
      {label} <ArrowRight className="h-3 w-3" />
    </Link>
  )
}

function InlineSkeleton({ className = '' }) {
  return <div className={cn('animate-pulse rounded-xl bg-slate-100', className)} />
}

export default function Dashboard() {
  const employee = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState(true)
  const [balances, setBalances] = useState(() => formatLeaveBalances({}, { includeLop: true }))
  const [leaves, setLeaves] = useState([])
  const [holidays, setHolidays] = useState([])
  const [documents, setDocuments] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [attendance, setAttendance] = useState(null)
  const [monthlyHours, setMonthlyHours] = useState(0)
  const [projectCount, setProjectCount] = useState(0)
  const [profile, setProfile] = useState(null)
  const { totalWeeklyMs, todayMs, chartLoading: weeklyHoursLoading } = useAttendanceWeeklyHours()

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
        setBalances(formatLeaveBalances(balanceData, { includeLop: true }))
        setLeaves(Array.isArray(data.leaves) ? data.leaves : [])
        setHolidays(Array.isArray(data.holidays) ? data.holidays : [])
        setDocuments(Array.isArray(data.documents) ? data.documents : [])
        setEnrollments(Array.isArray(data.enrollments) ? data.enrollments : [])
        setAttendance(data.attendance ?? null)
        setMonthlyHours(Number(data.monthlyHours) || 0)
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

  useEffect(() => {
    if (!employee?.id) return

    const balanceInterval = setInterval(() => {
      leaveService
        .getBalances()
        .then((data) => setBalances(formatLeaveBalances(data, { includeLop: true })))
        .catch((error) => console.error('[Dashboard] leave balances refresh failed:', error))
    }, 60_000)

    return () => clearInterval(balanceInterval)
  }, [employee?.id])

  const pendingLeaves = useMemo(() => leaves.filter((l) => l.status === 'Pending'), [leaves])
  const enrolledCourses = enrollments.filter((e) => e.status === 'Enrolled').length
  const completedCourses = enrollments.filter((e) => e.status === 'Completed').length

  const widgetSkeleton = <InlineSkeleton className="h-full min-h-0 rounded-xl" />

  const profileStats = useMemo(
    () => [
      {
        title: 'Hours This Month',
        value: formatWorkedDuration(monthlyHours * 3600000),
        icon: Clock,
        trend: weeklyHoursLoading
          ? 'Loading hours…'
          : `${formatWorkedDuration(todayMs)} today · ${formatWorkedDuration(totalWeeklyMs)} this week`,
        accent: 'sage',
        to: '/employee/timesheet',
      },
      {
        title: 'Pending for Approval',
        value: String(pendingLeaves.length),
        icon: CalendarOff,
        trend: pendingLeaves.length ? 'Awaiting admin approval' : 'None pending',
        accent: 'sage',
        to: '/employee/leave',
      },
      {
        title: 'Active Projects',
        value: String(projectCount),
        icon: FolderKanban,
        trend: projectCount ? 'Assigned to you' : 'None assigned',
        accent: 'sage',
        to: '/employee/timesheet',
      },
      {
        title: 'Training',
        value: String(completedCourses),
        icon: BookOpen,
        trend:
          completedCourses > 0 && enrolledCourses > 0
            ? `${completedCourses} completed · ${enrolledCourses} in progress`
            : completedCourses > 0
              ? `${completedCourses} completed`
              : enrolledCourses > 0
                ? `${enrolledCourses} in progress`
                : 'No enrollments',
        accent: 'sage',
        to: '/employee/training',
      },
    ],
    [
      monthlyHours,
      weeklyHoursLoading,
      todayMs,
      totalWeeklyMs,
      pendingLeaves.length,
      projectCount,
      completedCourses,
      enrolledCourses,
    ],
  )

  return (
    <div
      className="relative flex h-full min-h-0 w-full max-w-full flex-1 flex-col overflow-x-clip overflow-y-hidden"
      data-employee-dashboard
    >
      <div className={cn('dashboard-shell flex min-h-0 flex-1 flex-col gap-3 overflow-hidden', !loading && 'emp-page-content-in')}>
        <div className="shrink-0 space-y-2">
          <div className="pb-0.5">
            <ProfileCard
              employee={employee}
              profile={profile}
              attendance={attendance}
              horizontal
              stats={loading ? null : profileStats}
              statsLoading={loading}
              className="min-w-0 w-full"
            />
          </div>
        </div>

        <div className="emp-dash-widgets-grid">
          <div className="emp-dash-col emp-dash-col--side">
            <div className="emp-dash-session-slot">
              <DashboardSessionPanel compact />
            </div>
            <div className="emp-dash-widget-slot emp-dash-widget-slot--calendar">
              {loading ? (
                widgetSkeleton
              ) : (
                <DashboardCalendarCard fill holidays={holidays} />
              )}
            </div>
          </div>

          <div className="emp-dash-col emp-dash-col--main">
            <div className="emp-dash-widget-slot emp-dash-widget-slot--chart">
              <DashboardWorkInsights compact fill />
            </div>

            <div className="emp-dash-widgets-row emp-dash-widgets-row--triple">
              <div className="emp-dash-widget-slot">
                {loading ? (
                  widgetSkeleton
                ) : (
                  <SectionCard
                    compact
                    to="/employee/leave"
                    tone="sage"
                    icon={CalendarRange}
                    title="Leave balance"
                    action={<SectionLink to="/employee/leave" label="Apply" />}
                  >
                    <div className="emp-dash-leave-grid">
                      {balances.map((lb) => (
                        <LeaveCard
                          key={lb.key}
                          compact
                          type={lb.type}
                          used={lb.used}
                          total={lb.total}
                          remaining={lb.remaining}
                        />
                      ))}
                    </div>
                  </SectionCard>
                )}
              </div>

              <div className="emp-dash-widget-slot">
                {loading ? (
                  widgetSkeleton
                ) : (
                  <UpcomingHolidaysCard
                    compact
                    fill
                    className="emp-dash-card emp-dash-card--sky"
                    holidays={holidays}
                  />
                )}
              </div>

              <div className="emp-dash-widget-slot">
                {loading ? (
                  widgetSkeleton
                ) : (
                  <DashboardDocumentRequests
                    compact
                    fill
                    className="emp-dash-card emp-dash-card--amber"
                    documents={documents}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
