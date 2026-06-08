import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen } from 'lucide-react'
import { Badge, statusVariant } from '@components/employee/ui/badge'
import { formatDate } from '@pages/employee/lib/utils'
import { cn } from '@pages/employee/lib/utils'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'

const CARD_CLASS = portalCardClass({ className: 'flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-5' })
const ACTIVITY_LIMIT = 5

function activityTimestamp(enrollment) {
  if (enrollment.status === 'Completed' && enrollment.completedAt) {
    return new Date(enrollment.completedAt).getTime()
  }
  return new Date(enrollment.enrolledAt || 0).getTime()
}

function activityDateLabel(enrollment) {
  const raw =
    enrollment.status === 'Completed' && enrollment.completedAt
      ? enrollment.completedAt
      : enrollment.enrolledAt
  return raw ? formatDate(raw, 'MMM d, yyyy') : '—'
}

function statusLabel(status) {
  if (status === 'Enrolled') return 'In progress'
  return status
}

function TrainingActivityRow({ enrollment }) {
  const isCompleted = enrollment.status === 'Completed'

  return (
    <li className="flex items-start justify-between gap-2 px-3 py-2.5 sm:px-4">
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-foreground" title={enrollment.courseTitle}>
          {enrollment.courseTitle}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted">
          {enrollment.topic || 'Course'}
          <span className="hidden sm:inline"> · {activityDateLabel(enrollment)}</span>
        </p>
      </div>
      <Badge
        variant={statusVariant(enrollment.status)}
        className={cn(
          'shrink-0 text-[10px]',
          isCompleted && 'bg-emerald-100 font-bold text-emerald-800 ring-1 ring-emerald-200/80',
        )}
      >
        {statusLabel(enrollment.status)}
      </Badge>
    </li>
  )
}

export function DashboardTrainingActivity({ enrollments = [], loading = false, className }) {
  const activity = useMemo(
    () =>
      [...enrollments]
        .sort((a, b) => activityTimestamp(b) - activityTimestamp(a))
        .slice(0, ACTIVITY_LIMIT),
    [enrollments],
  )

  const completedCount = enrollments.filter((e) => e.status === 'Completed').length
  const enrolledCount = enrollments.filter((e) => e.status === 'Enrolled').length

  return (
    <InteractiveCard className={cn(CARD_CLASS, 'emp-dash-card emp-dash-card--amber', className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="emp-dash-icon emp-dash-icon--amber" aria-hidden>
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-heading text-base font-semibold text-foreground">Training activity</h3>
            {!loading && enrollments.length > 0 ? (
              <p className="mt-0.5 text-xs text-muted">
                <span className="font-semibold text-emerald-700">{completedCount}</span> completed
                {enrolledCount > 0 ? (
                  <>
                    {' '}
                    · <span className="font-semibold text-foreground">{enrolledCount}</span> in progress
                  </>
                ) : null}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-muted">Your course enrollments</p>
            )}
          </div>
        </div>
        <Link
          to="/employee/training"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Training <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : activity.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted">
          No training enrollments yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <ul className="divide-y divide-border">
            {activity.map((enrollment) => (
              <TrainingActivityRow key={enrollment.id} enrollment={enrollment} />
            ))}
          </ul>
        </div>
      )}
    </InteractiveCard>
  )
}
