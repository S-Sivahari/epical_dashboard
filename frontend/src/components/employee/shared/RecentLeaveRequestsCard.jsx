import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarRange, Clock, Plus } from 'lucide-react'
import { format, isSameDay, parseISO, startOfDay } from 'date-fns'
import { cn } from '@pages/employee/lib/utils'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'

export const RECENT_LEAVE_LIMIT = 3

const LEAVE_TYPE_META = {
  'Casual Leave': { initial: 'C', soft: 'bg-[#3d7a6a]/12 text-[#2d6b52]' },
  'Sick Leave': { initial: 'S', soft: 'bg-[#4a7a9a]/12 text-[#3d6b8a]' },
  'Earned Leave': { initial: 'E', soft: 'bg-[#6b5b8a]/12 text-[#5c4f78]' },
  'Compensation Leave': { initial: 'P', soft: 'bg-[#c27803]/12 text-[#9a5f02]' },
}

const STATUS_META = {
  Pending: { dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-800 ring-amber-200/80' },
  Approved: { dot: 'bg-[#276749]', pill: 'bg-[#dff0e4] text-[#1e5a3d] ring-[#a0c4ab]/80' },
  Rejected: { dot: 'bg-red-500', pill: 'bg-red-50 text-red-800 ring-red-200/80' },
  Cancelled: { dot: 'bg-slate-400', pill: 'bg-slate-100 text-slate-600 ring-slate-200/80' },
}

const CARD_CLASS = portalCardClass({ className: 'flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-5' })

function parseLeaveDate(dateStr) {
  if (!dateStr) return null
  const d = startOfDay(new Date(dateStr))
  return Number.isNaN(d.getTime()) ? null : d
}

function getLeaveTypeMeta(type) {
  return (
    LEAVE_TYPE_META[type] ?? {
      initial: (type?.[0] ?? 'L').toUpperCase(),
      soft: 'bg-slate-100 text-slate-600',
    }
  )
}

function getStatusMeta(status) {
  return STATUS_META[status] ?? STATUS_META.Cancelled
}

function formatDateRange(from, to) {
  const start = parseLeaveDate(from)
  const end = parseLeaveDate(to)
  if (!start) return ''
  if (!end || isSameDay(start, end)) return format(start, 'MMM d, yyyy')
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  }
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`
}

export function getRecentLeaves(leaves, limit = RECENT_LEAVE_LIMIT) {
  return (Array.isArray(leaves) ? leaves : [])
    .slice()
    .sort((a, b) => {
      const aTime = parseLeaveDate(a.from)?.getTime() ?? parseISO(a.createdAt ?? '').getTime() ?? 0
      const bTime = parseLeaveDate(b.from)?.getTime() ?? parseISO(b.createdAt ?? '').getTime() ?? 0
      return bTime - aTime
    })
    .slice(0, limit)
}

function StatusPill({ status }) {
  const meta = getStatusMeta(status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
        meta.pill,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden />
      {status}
    </span>
  )
}

function LeaveRowCard({ leave }) {
  const typeMeta = getLeaveTypeMeta(leave.type)
  const dayCount = leave.days ?? leave.totalLeaveDays ?? 1
  const isHalfDay = leave.leaveDuration === 'Half Day'

  return (
    <li className="flex min-h-[4.5rem] w-full items-center gap-3 rounded-xl border border-border bg-white p-3 shadow-sm transition-shadow hover:shadow-md sm:gap-4 sm:p-4">
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
          typeMeta.soft,
        )}
        aria-hidden
      >
        {typeMeta.initial}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{leave.type}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <CalendarRange className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span className="truncate">{formatDateRange(leave.from, leave.to)}</span>
          </span>
          <span className="text-slate-300" aria-hidden>
            |
          </span>
          <span className="font-medium text-foreground/70">
            {dayCount} day{dayCount === 1 ? '' : 's'}
            {isHalfDay ? ' (half)' : ''}
          </span>
        </div>
      </div>

      <div className="shrink-0">
        <StatusPill status={leave.status} />
      </div>
    </li>
  )
}

export function RecentLeaveRequestsCard({ leaves = [], className }) {
  const recent = useMemo(() => getRecentLeaves(leaves), [leaves])
  const pendingCount = useMemo(
    () => recent.filter((leave) => leave.status === 'Pending').length,
    [recent],
  )

  return (
    <InteractiveCard className={cn(CARD_CLASS, className)}>
      <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="emp-dash-icon emp-dash-icon--amber" aria-hidden>
            <CalendarRange className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-heading text-base font-semibold text-foreground">Recent leave requests</h3>
            <p className="mt-0.5 text-xs text-muted">Your latest applications</p>
          </div>
        </div>
        <Link
          to="/employee/leave"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-[#f4faf6]"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {recent.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-[#f4faf6]/80 px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No leave requests yet</p>
          <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-muted">
            Submit a leave application and track its status here.
          </p>
          <Link
            to="/employee/leave"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Apply for leave
          </Link>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ul
            className="timesheet-panel-scroll flex max-h-64 flex-col gap-3 overflow-y-auto overscroll-contain pr-1"
            aria-label="Recent leave requests"
          >
            {recent.map((leave) => (
              <LeaveRowCard key={leave.id} leave={leave} />
            ))}
          </ul>

          {pendingCount > 0 ? (
            <div className="mt-3 flex shrink-0 items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-200/70">
              <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>
                <span className="font-semibold">{pendingCount}</span> request
                {pendingCount === 1 ? '' : 's'} awaiting admin approval
              </span>
            </div>
          ) : (
            <p className="mt-3 shrink-0 text-center text-[11px] text-muted">
              Showing {recent.length} most recent request{recent.length === 1 ? '' : 's'}
            </p>
          )}
        </div>
      )}
    </InteractiveCard>
  )
}
