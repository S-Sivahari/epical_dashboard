import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { Loader2, BarChart3, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@pages/employee/lib/utils'
import { formatWorkedDuration } from '@utils/durationFormat'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'
import { useAttendanceWeeklyHours } from '@hooks/useAttendanceWeeklyHours'

const TimesheetWeeklyChart = lazy(() =>
  import('@pages/employee/TimesheetWeeklyChart').then((m) => ({ default: m.TimesheetWeeklyChart })),
)

const CARD_CLASS = portalCardClass({ className: 'overflow-hidden p-4 sm:p-5' })

export function DashboardWorkInsights({ className, compact = false, fill = false }) {
  const { weeklyHours, totalWeeklyMs, todayMs, chartLoading } = useAttendanceWeeklyHours()
  const cardClass = compact
    ? portalCardClass({ className: 'flex h-full min-h-0 flex-col overflow-hidden p-3' })
    : CARD_CLASS

  return (
    <InteractiveCard
      to="/employee/timesheet"
      className={cn(cardClass, 'emp-dash-card emp-dash-card--sage flex flex-col', className)}
    >
      <div
        className={cn(
          'flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-border',
          compact ? 'mb-2 pb-2' : 'mb-3 pb-3',
        )}
      >
        <div className="flex min-w-0 items-start gap-2">
          <div
            className={cn('emp-dash-icon emp-dash-icon--sage', compact && 'h-7 w-7')}
            aria-hidden
          >
            <BarChart3 className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          </div>
          <div className="min-w-0">
            <h3 className="emp-dash-work-insights__title font-heading font-semibold text-foreground">
              Hours this week
            </h3>
            <p className="emp-dash-work-insights__subtitle mt-0.5 text-muted">
              {chartLoading
                ? 'Loading…'
                : `Today ${formatWorkedDuration(todayMs)} · ${formatWorkedDuration(totalWeeklyMs)} total`}
            </p>
          </div>
        </div>
        <Link
          to="/employee/timesheet"
          className="emp-dash-btn emp-dash-work-insights__link inline-flex shrink-0 items-center gap-1.5 font-semibold"
        >
          Timesheet <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      </div>

      <div
        className={cn(
          'min-h-0 flex-1',
          fill && 'emp-dash-work-insights-chart flex flex-col',
        )}
      >
        {chartLoading ? (
          <div className="flex h-full flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex h-full flex-1 items-center justify-center text-xs text-muted">
                Loading chart…
              </div>
            }
          >
            <TimesheetWeeklyChart data={weeklyHours} fill={fill} />
          </Suspense>
        )}
      </div>
    </InteractiveCard>
  )
}
