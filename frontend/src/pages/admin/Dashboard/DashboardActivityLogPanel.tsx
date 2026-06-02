import { useEffect, useMemo, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import api from '@/services/api'
import { DateInput } from '@components/shared/DateInput'
import { cn } from '@/utils/cn'
import { formatDateKey } from './dashboardChartUtils'

export type DailyActivityEntry = {
  id: string
  userName: string
  message: string
  time: string
}

type DashboardActivityLogPanelProps = {
  className?: string
}

function formatActivityTime(iso: string): string {
  try {
    return format(parseISO(iso), 'h:mm a')
  } catch {
    return '—'
  }
}

function shiftDateKey(isoDate: string, deltaDays: number): string {
  try {
    return formatDateKey(addDays(parseISO(`${isoDate}T12:00:00`), deltaDays))
  } catch {
    return isoDate
  }
}

export function DashboardActivityLogPanel({ className }: DashboardActivityLogPanelProps) {
  const todayKey = useMemo(() => formatDateKey(new Date()), [])
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [entries, setEntries] = useState<DailyActivityEntry[]>([])
  const [loading, setLoading] = useState(true)

  const maxDate = todayKey
  const minDate = useMemo(() => formatDateKey(addDays(new Date(), -90)), [])

  const isToday = selectedDate === todayKey
  const isAtMin = selectedDate <= minDate

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const { data } = await api.get<{ date: string; entries: DailyActivityEntry[] }>(
          '/employees/daily-activity',
          { params: { date: selectedDate } },
        )
        if (!cancelled) {
          setEntries(Array.isArray(data.entries) ? data.entries : [])
        }
      } catch {
        if (!cancelled) setEntries([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [selectedDate])

  const dateLabel = (() => {
    try {
      return format(parseISO(`${selectedDate}T12:00:00`), 'MMM d, yyyy')
    } catch {
      return selectedDate
    }
  })()

  const goPreviousDay = () => {
    if (isAtMin) return
    const next = shiftDateKey(selectedDate, -1)
    if (next < minDate) {
      setSelectedDate(minDate)
      return
    }
    setSelectedDate(next)
  }

  const goNextDay = () => {
    if (isToday) return
    const next = shiftDateKey(selectedDate, 1)
    if (next > maxDate) {
      setSelectedDate(maxDate)
      return
    }
    setSelectedDate(next)
  }

  return (
    <section
      className={cn(
        'dashboard-workspace-panel dashboard-workspace-panel--mint dashboard-activity-panel',
        className,
      )}
      aria-label="User activity log"
    >
      <header className="dashboard-insight-panel-header dashboard-activity-header">
        <h3 className="dashboard-insight-panel-title">Activity log</h3>
        <div className="dashboard-activity-nav" role="group" aria-label="Activity log date">
          <button
            type="button"
            className="dashboard-activity-nav-btn"
            onClick={goPreviousDay}
            disabled={isAtMin}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
          <span className="dashboard-activity-nav-date" title={dateLabel}>
            {dateLabel}
          </span>
          <button
            type="button"
            className="dashboard-activity-nav-btn"
            onClick={goNextDay}
            disabled={isToday}
            aria-label="Next day"
          >
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
          <div className="dashboard-activity-date-picker-wrap">
            <DateInput
              value={selectedDate}
              onChange={setSelectedDate}
              minDate={minDate}
              maxDate={maxDate}
              withCalendar
              className="dashboard-activity-date-picker"
              aria-label="Choose activity log date"
            />
          </div>
        </div>
      </header>

      <div className="dashboard-insight-panel-body dashboard-workspace-body dashboard-activity-body">
        {loading ? (
          <div className="dashboard-activity-loading space-y-1.5 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-7 rounded-md bg-slate-100 skeleton" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="dashboard-workspace-empty dashboard-activity-empty">
            No user activity recorded for this date.
          </p>
        ) : (
          <ul className="dashboard-activity-timeline" role="list">
            {entries.map((entry, index) => {
              const isLast = index === entries.length - 1
              return (
                <li
                  key={entry.id}
                  className={cn('dashboard-activity-item', isLast && 'dashboard-activity-item--last')}
                >
                  <span className="dashboard-activity-dot" aria-hidden />
                  <div className="dashboard-activity-content">
                    <p className="dashboard-activity-user">{entry.userName}</p>
                    <p className="dashboard-activity-message">{entry.message}</p>
                  </div>
                  <time className="dashboard-activity-time">{formatActivityTime(entry.time)}</time>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
