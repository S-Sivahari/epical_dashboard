import { useEffect, useLayoutEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { Loader2, BarChart3, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTimesheetStore } from '@store/employee/timesheetStore'
import { getWeekRange, isDateInRange } from '@pages/employee/lib/dateFilters'
import { cn } from '@pages/employee/lib/utils'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'

const TimesheetWeeklyChart = lazy(() =>
  import('@pages/employee/TimesheetWeeklyChart').then((m) => ({ default: m.TimesheetWeeklyChart })),
)

const CARD_CLASS = portalCardClass({ className: 'overflow-hidden p-4 sm:p-5' })

function hoursFromMs(ms) {
  return Math.round((ms / 3600000) * 10) / 10
}

function getDayKey(date) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]
}

function segmentHours(seg, checkedIn, liveNow) {
  const isOpen = checkedIn && !seg.checkOutTime
  const startMs = new Date(seg.checkInTime).getTime()
  const endMs = seg.checkOutTime ? new Date(seg.checkOutTime).getTime() : isOpen ? liveNow : startMs
  return hoursFromMs(Math.max(0, endMs - startMs))
}

export function DashboardWorkInsights({ className, compact = false, fill = false }) {
  const { checkedIn, attendanceHistory, initialized, hydrate, serverTimeSkew } = useTimesheetStore()
  const [liveNow, setLiveNow] = useState(() => Date.now() + (serverTimeSkew || 0))
  const chartWrapRef = useRef(null)
  const fallbackHeight = compact ? 160 : 220
  const [chartHeight, setChartHeight] = useState(fallbackHeight)
  const cardClass = compact
    ? portalCardClass({ className: 'flex h-full min-h-0 flex-col overflow-hidden p-3' })
    : CARD_CLASS

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useLayoutEffect(() => {
    if (!fill) {
      setChartHeight(fallbackHeight)
      return
    }

    const node = chartWrapRef.current
    if (!node) return

    const measure = () => {
      const next = Math.round(node.getBoundingClientRect().height)
      setChartHeight(next > 0 ? next : fallbackHeight)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [fill, fallbackHeight, initialized])

  useEffect(() => {
    if (!checkedIn) return undefined
    const tick = () => setLiveNow(Date.now() + (serverTimeSkew || 0))
    tick()
    const id = setInterval(tick, 15000)
    return () => clearInterval(id)
  }, [checkedIn, serverTimeSkew])

  const weekRange = useMemo(() => getWeekRange(), [liveNow])

  const weeklyHours = useMemo(() => {
    const byDay = {}
    const chartDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

    attendanceHistory.forEach((seg) => {
      if (!isDateInRange(seg.date, weekRange.start, weekRange.end)) return
      const key = getDayKey(new Date(`${seg.date}T12:00:00`))
      byDay[key] = (byDay[key] || 0) + segmentHours(seg, checkedIn, liveNow)
    })

    return chartDays.map((day) => ({
      day,
      hours: Math.round((byDay[day] || 0) * 10) / 10,
      target: 8,
    }))
  }, [attendanceHistory, checkedIn, liveNow, weekRange])

  const totalWeekly = weeklyHours.reduce((sum, row) => sum + row.hours, 0)
  const chartLoading = !initialized

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
              Weekly hours
            </h3>
            <p className="emp-dash-work-insights__subtitle mt-0.5 text-muted">
              {chartLoading ? 'Loading…' : `${totalWeekly.toFixed(1)}h this week`}
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
        ref={chartWrapRef}
        className={cn(
          'min-h-0 flex-1',
          fill && 'emp-dash-widget-body',
        )}
        style={{ minHeight: fallbackHeight }}
      >
        {chartLoading ? (
          <div
            className="flex h-full items-center justify-center"
            style={{ minHeight: fallbackHeight }}
          >
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Suspense
            fallback={
              <div
                className="flex h-full items-center justify-center text-xs text-muted"
                style={{ minHeight: fallbackHeight }}
              >
                Loading chart…
              </div>
            }
          >
            <TimesheetWeeklyChart data={weeklyHours} height={chartHeight} />
          </Suspense>
        )}
      </div>
    </InteractiveCard>
  )
}
