import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO, startOfDay } from 'date-fns'
import { useLeaves } from '@hooks/useLeaves'
import {
  filterUpcomingHolidays,
  HOLIDAY_WINDOW_DAYS,
} from '@components/employee/shared/upcomingHolidays'
import { ROUTES } from '@constants/routes'
import { cn } from '@/utils/cn'
import { formatDate } from '@/utils/formatDate'
import type { OutTodayEntry, PendingProjectReviewEntry } from './dashboardLeftPanelsData'

const HOLIDAY_TYPE_DOT: Record<string, string> = {
  National: 'dashboard-deadline-dot--green',
  Company: 'dashboard-deadline-dot--amber',
  Optional: 'dashboard-deadline-dot--amber',
  'Company Event': 'dashboard-deadline-dot--green',
}

const HOLIDAY_TYPE_LABEL: Record<string, string> = {
  National: 'Public holiday',
  Company: 'Company holiday',
  Optional: 'Optional holiday',
  'Company Event': 'Company event',
}

function formatHolidayDateLabel(dateStr: string): string {
  const parsed = startOfDay(parseISO(dateStr))
  if (Number.isNaN(parsed.getTime())) return dateStr
  return format(parsed, 'MMM d')
}

function normalizeLeaveType(type: string): string {
  const t = type.toLowerCase()
  if (t.includes('sick')) return 'Sick'
  if (t.includes('wfh') || t.includes('work from home')) return 'WFH'
  if (t.includes('annual') || t.includes('casual') || t.includes('privilege')) return 'Annual'
  return type || 'Leave'
}

function isOutToday(from: string, to: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T23:59:59`)
  return start <= today && today <= end
}

function reviewPointLabel(point?: string | null): string {
  if (!point) return 'Review'
  return `${String(point).toUpperCase()} review`
}

type DashboardLeftInsightsProps = {
  className?: string
  pendingReviews?: PendingProjectReviewEntry[]
}

export function DashboardLeftInsights({
  className,
  pendingReviews = [],
}: DashboardLeftInsightsProps) {
  const { leaves, holidays, companyCalendarEvents } = useLeaves()

  const upcomingHolidays = useMemo(() => {
    const eventsAsHolidays = companyCalendarEvents.map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      description: e.description,
      type: 'Company Event' as const,
    }))
    return filterUpcomingHolidays([...holidays, ...eventsAsHolidays])
  }, [holidays, companyCalendarEvents])

  const outToday = useMemo((): OutTodayEntry[] => {
    return leaves
      .filter((l) => l.status === 'Approved' && isOutToday(l.from, l.to))
      .map((l) => ({
        id: l.id,
        name: l.employeeName || 'Employee',
        leaveType: normalizeLeaveType(l.type),
        returnDate: formatDate(l.to, 'MMM d'),
      }))
  }, [leaves])

  return (
    <div className={cn('dashboard-left-insights', className)}>
      <section className="dashboard-insight-panel dashboard-insight-panel--mint dashboard-insight-panel--out-today">
        <header className="dashboard-insight-panel-header">
          <h3 className="dashboard-insight-panel-title">Who&apos;s out today</h3>
        </header>
        <div className="dashboard-insight-panel-body">
          <div className="dashboard-insight-panel-scroll">
            {outToday.length === 0 ? (
              <p className="dashboard-insight-empty">No approved leave for today.</p>
            ) : (
              <ul className="dashboard-insight-list" role="list">
                {outToday.map((entry, index) => (
                  <li
                    key={entry.id}
                    className={cn(
                      'dashboard-insight-row',
                      index < outToday.length - 1 && 'dashboard-insight-row--bordered',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="dashboard-insight-primary">{entry.name}</p>
                      <p className="dashboard-insight-secondary">
                        {entry.leaveType} · Returns {entry.returnDate}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="dashboard-insight-panel dashboard-insight-panel--mint">
        <header className="dashboard-insight-panel-header">
          <h3 className="dashboard-insight-panel-title">Project Reviews</h3>
          {pendingReviews.length > 0 ? (
            <span
              className="dashboard-insight-panel-count"
              aria-label={`${pendingReviews.length} pending`}
            >
              {pendingReviews.length}
            </span>
          ) : null}
        </header>
        <div className="dashboard-insight-panel-body">
          <div className="dashboard-insight-panel-scroll">
            {pendingReviews.length === 0 ? (
              <p className="dashboard-insight-empty">No project reviews requested.</p>
            ) : (
              <ul className="dashboard-insight-list" role="list">
                {pendingReviews.map((review, index) => (
                  <li
                    key={review.id}
                    className={cn(
                      'dashboard-insight-row dashboard-insight-row--deadline',
                      index < pendingReviews.length - 1 && 'dashboard-insight-row--bordered',
                    )}
                  >
                    <span
                      className="dashboard-deadline-dot dashboard-deadline-dot--amber"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={ROUTES.PROJECT_CELL(review.projectId, review.cellId)}
                        className="dashboard-insight-primary hover:underline"
                      >
                        {review.projectName}
                      </Link>
                      <p className="dashboard-insight-secondary">
                        {review.employeeName}
                        {review.cellName ? ` · ${review.cellName}` : ''}
                        {` · ${reviewPointLabel(review.reviewPoint)}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="dashboard-insight-panel dashboard-insight-panel--mint">
        <header className="dashboard-insight-panel-header">
          <h3 className="dashboard-insight-panel-title">Upcomming Holidays and Events</h3>
        </header>
        <div className="dashboard-insight-panel-body">
          <div className="dashboard-insight-panel-scroll">
            {upcomingHolidays.length === 0 ? (
              <p className="dashboard-insight-empty">
                No holidays in the next {HOLIDAY_WINDOW_DAYS} days.
              </p>
            ) : (
              <ul className="dashboard-insight-list" role="list">
                {upcomingHolidays.map((holiday, index) => (
                  <li
                    key={holiday.id ?? holiday.date}
                    className={cn(
                      'dashboard-insight-row dashboard-insight-row--deadline',
                      index < upcomingHolidays.length - 1 && 'dashboard-insight-row--bordered',
                    )}
                  >
                    <span
                      className={cn(
                        'dashboard-deadline-dot',
                        HOLIDAY_TYPE_DOT[holiday.type] ?? 'dashboard-deadline-dot--green',
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="dashboard-insight-deadline-date">
                        {formatHolidayDateLabel(holiday.date)}
                      </p>
                      <p className="dashboard-insight-primary">{holiday.title}</p>
                      <p className="dashboard-insight-secondary">
                        {HOLIDAY_TYPE_LABEL[holiday.type] ?? 'Holiday'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
