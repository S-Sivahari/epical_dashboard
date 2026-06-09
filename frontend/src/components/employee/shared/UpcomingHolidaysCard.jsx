import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays } from 'lucide-react'
import {
  addDays,
  differenceInCalendarDays,
  format,
  isToday,
  isTomorrow,
  startOfDay,
} from 'date-fns'
import { cn } from '@pages/employee/lib/utils'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'
import { Badge } from '@components/employee/ui/badge'

export const HOLIDAY_WINDOW_DAYS = 30

const TYPE_STYLES = {
  National: { accent: 'border-[#a0c4ab]/60 bg-[#dff0e4]/80', dot: 'bg-[#276749]', badge: 'success', label: 'National' },
  Company: { accent: 'border-[#a0c4ab]/50 bg-[#f4faf6]', dot: 'bg-[#2f6b4f]', badge: 'default', label: 'Company' },
  Optional: { accent: 'border-amber-200 bg-amber-50/80', dot: 'bg-amber-500', badge: 'warning', label: 'Optional' },
  'Company Event': { accent: 'border-[#c1dac7]/70 bg-[#e8f2e6]/90', dot: 'bg-[#1e5a3d]', badge: 'secondary', label: 'Event' },
}

const CARD_CLASS = portalCardClass({ className: 'flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-5' })

function parseHolidayDate(dateStr) {
  if (!dateStr) return null
  const d = startOfDay(new Date(dateStr))
  return Number.isNaN(d.getTime()) ? null : d
}

export function filterUpcomingHolidays(holidays, windowDays = HOLIDAY_WINDOW_DAYS) {
  const today = startOfDay(new Date())
  const end = addDays(today, windowDays)

  return (Array.isArray(holidays) ? holidays : [])
    .filter((h) => {
      if (h.skipped) return false
      const d = parseHolidayDate(h.date)
      return d && d >= today && d <= end
    })
    .sort((a, b) => parseHolidayDate(a.date) - parseHolidayDate(b.date))
}

function getCountdownLabel(date) {
  if (isToday(date)) return { text: 'Today', tone: 'today' }
  if (isTomorrow(date)) return { text: 'Tomorrow', tone: 'soon' }
  const days = differenceInCalendarDays(date, startOfDay(new Date()))
  if (days <= 7) return { text: `In ${days} days`, tone: 'soon' }
  return { text: `In ${days} days`, tone: 'default' }
}

function getTypeStyle(type) {
  return TYPE_STYLES[type] ?? TYPE_STYLES.National
}

function HolidayRow({ holiday }) {
  const date = parseHolidayDate(holiday.date)
  if (!date) return null

  const typeStyle = getTypeStyle(holiday.type)
  const countdown = getCountdownLabel(date)

  return (
    <li className="relative pl-8">
      <span
        className={cn(
          'absolute left-[0.6875rem] top-5 h-2 w-2 -translate-x-1/2 rounded-full ring-2 ring-white',
          typeStyle.dot,
        )}
        aria-hidden
      />
      <div
        className={cn(
          'flex items-stretch gap-3 rounded-xl border p-3 transition-colors hover:shadow-sm',
          typeStyle.accent,
        )}
      >
        <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-white/90 px-1 py-2 text-center shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            {format(date, 'MMM')}
          </span>
          <span className="font-display text-xl font-bold leading-none text-foreground">
            {format(date, 'd')}
          </span>
          <span className="mt-0.5 text-[10px] text-muted">{format(date, 'EEE')}</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <p className="truncate text-sm font-semibold text-foreground">{holiday.title}</p>
          <Badge variant={typeStyle.badge} className="w-fit text-[10px]">
            {typeStyle.label}
          </Badge>
        </div>

        <div className="flex shrink-0 items-center">
          <span
            className={cn(
              'rounded-full px-2 py-1 text-[10px] font-semibold',
              countdown.tone === 'today' && 'bg-primary text-white',
              countdown.tone === 'soon' && 'bg-white/90 text-primary',
              countdown.tone === 'default' && 'bg-white/70 text-muted',
            )}
          >
            {countdown.text}
          </span>
        </div>
      </div>
    </li>
  )
}

function CompactHolidayRow({ holiday }) {
  const date = parseHolidayDate(holiday.date)
  if (!date) return null

  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-white/80 px-2.5 py-1.5 text-xs">
      <span className="shrink-0 font-medium tabular-nums text-muted">{format(date, 'MMM d')}</span>
      <span className="min-w-0 truncate text-foreground">{holiday.title}</span>
    </li>
  )
}

export function UpcomingHolidaysCard({ holidays = [], className, compact = false, fill = false }) {
  const upcoming = useMemo(() => filterUpcomingHolidays(holidays), [holidays])
  const cardClass = compact
    ? portalCardClass({ className: 'flex h-full min-h-0 flex-col overflow-hidden p-3' })
    : CARD_CLASS

  if (compact) {
    return (
      <InteractiveCard to="/employee/calendar" className={cn(cardClass, className)}>
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2 border-b border-border pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="emp-dash-icon emp-dash-icon--sky h-7 w-7" aria-hidden>
              <CalendarDays className="h-3.5 w-3.5" />
            </div>
            <h3 className="font-heading text-sm font-semibold text-foreground">Upcoming holidays</h3>
          </div>
          <Link
            to="/employee/calendar"
            className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-primary hover:underline"
          >
            Calendar <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className={cn(fill && 'emp-dash-widget-body min-h-0 flex-1')}>
          {upcoming.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted">No upcoming holidays</p>
          ) : (
            <ul
              className={cn(
                'space-y-1.5 pr-0.5',
                fill ? 'min-h-0' : 'max-h-44 overflow-y-auto overscroll-contain',
              )}
            >
              {upcoming.map((holiday) => (
                <CompactHolidayRow key={holiday.id ?? holiday.date} holiday={holiday} />
              ))}
            </ul>
          )}
        </div>
      </InteractiveCard>
    )
  }

  return (
    <InteractiveCard to="/employee/calendar" className={cn(CARD_CLASS, className)}>
      <div className="mb-3 flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="emp-dash-icon emp-dash-icon--sky" aria-hidden>
            <CalendarDays className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-heading text-base font-semibold text-foreground">Upcoming holidays</h3>
          </div>
        </div>
        <Link
          to="/employee/calendar"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Calendar <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {upcoming.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <CalendarDays className="mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-foreground">No holidays coming up</p>
          <p className="mt-1 max-w-[220px] text-xs text-muted">
            There are no company holidays in the next {HOLIDAY_WINDOW_DAYS} days.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className="timesheet-panel-scroll min-h-0 max-h-64 flex-1 overflow-y-auto overscroll-contain pr-1"
            aria-label="Upcoming holidays list"
          >
            <ul className="relative flex flex-col gap-3 pb-1 before:absolute before:bottom-2 before:left-[0.6875rem] before:top-2 before:w-px before:bg-border">
              {upcoming.map((holiday) => (
                <HolidayRow key={holiday.id ?? holiday.date} holiday={holiday} />
              ))}
            </ul>
          </div>
          <p className="mt-3 shrink-0 border-t border-border pt-2 text-center text-[11px] text-muted">
            {upcoming.length} holiday{upcoming.length === 1 ? '' : 's'} in the next {HOLIDAY_WINDOW_DAYS} days
          </p>
        </div>
      )}
    </InteractiveCard>
  )
}