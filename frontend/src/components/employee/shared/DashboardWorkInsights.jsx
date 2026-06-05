import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
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

export function DashboardWorkInsights({ className }) {
  const { checkedIn, attendanceHistory, initialized, hydrate, serverTimeSkew } = useTimesheetStore()
  const [liveNow, setLiveNow] = useState(() => Date.now() + (serverTimeSkew || 0))

  useEffect(() => {
    void hydrate()
  }, [hydrate])

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
    <InteractiveCard className={cn(CARD_CLASS, 'emp-dash-card emp-dash-card--sage flex flex-col', className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="emp-dash-icon emp-dash-icon--sage" aria-hidden>
            <BarChart3 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-heading text-base font-semibold text-foreground">Weekly hours</h3>
            <p className="mt-0.5 text-xs text-muted">
              {chartLoading ? 'Loading…' : `${totalWeekly.toFixed(1)}h logged this week`}
            </p>
          </div>
        </div>
        <Link
          to="/employee/timesheet"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Timesheet <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="min-h-0 flex-1" style={{ minHeight: 220 }}>
        {chartLoading ? (
          <div className="flex h-full min-h-[220px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex h-full min-h-[220px] items-center justify-center text-xs text-muted">
                Loading chart…
              </div>
            }
          >
            <TimesheetWeeklyChart data={weeklyHours} height={220} />
          </Suspense>
        )}
      </div>
    </InteractiveCard>
  )
}
