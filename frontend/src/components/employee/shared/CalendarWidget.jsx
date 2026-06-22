import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
} from 'date-fns'
import { cn } from '@pages/employee/lib/utils'

export function CalendarWidget({
  holidays = [],
  highlightDates = [],
  onMonthChange,
  compact = false,
  stretch = false,
}) {
  const [current, setCurrent] = useState(new Date())
  
  const handleMonthChange = (newDate) => {
    setCurrent(newDate)
    if (onMonthChange) {
      onMonthChange(newDate)
    }
  }
  
  const monthStart = startOfMonth(current)
  const monthEnd = endOfMonth(current)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPadding = getDay(monthStart)

  const holidayDates = holidays.map((h) => h.date)
  const isHoliday = (day) => holidayDates.some((d) => isSameDay(new Date(d), day))
  const isHighlighted = (day) => highlightDates.some((d) => isSameDay(new Date(d), day))
  const rowCount = Math.ceil((startPadding + days.length) / 7)

  const monthNav = (
    <div className={cn('flex shrink-0 items-center justify-between', compact ? 'mb-2' : 'mb-4')}>
      <h3 className={cn('font-heading font-semibold', compact ? 'text-sm' : 'text-base')}>
        {format(current, compact ? 'MMM yyyy' : 'MMMM yyyy')}
      </h3>
      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={() => handleMonthChange(subMonths(current, 1))}
          className="rounded-md p-1 hover:bg-slate-100"
        >
          <ChevronLeft className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </button>
        <button
          type="button"
          onClick={() => handleMonthChange(addMonths(current, 1))}
          className="rounded-md p-1 hover:bg-slate-100"
        >
          <ChevronRight className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </button>
      </div>
    </div>
  )

  const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
    <div key={d} className={cn('font-medium text-muted', compact ? 'py-0.5' : 'py-1')}>
      {d}
    </div>
  ))

  const dayCellClass = (day) => {
    const isToday = isSameDay(day, new Date())
    const holiday = isHoliday(day)
    const highlighted = isHighlighted(day)

    return cn(
      'emp-calendar-day-cell flex items-center justify-center rounded-md',
      stretch ? 'h-full min-h-0 text-sm' : compact ? 'h-6 text-[11px]' : 'h-8 text-sm',
      !isToday && !holiday && !highlighted && 'emp-calendar-day-cell--default',
      !isSameMonth(day, current) && 'text-slate-300',
      isToday && 'bg-primary font-semibold text-white',
      holiday && !isToday && 'bg-amber-100 text-amber-800',
      highlighted && !holiday && !isToday && 'bg-primary/10 text-primary',
    )
  }

  if (compact && stretch) {
    return (
      <div className="emp-calendar-widget emp-calendar-widget--stretch flex min-h-0 flex-1 flex-col">
        {monthNav}
        <div
          className={cn(
            'grid shrink-0 grid-cols-7 gap-0.5 text-center',
            compact ? 'text-[10px]' : 'text-xs',
          )}
        >
          {weekdayLabels}
        </div>
        <div
          className="emp-calendar-stretch-grid grid min-h-0 flex-1 grid-cols-7 gap-0.5"
          style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: startPadding }).map((_, i) => (
            <div key={`pad-${i}`} className="emp-calendar-day-cell emp-calendar-day-cell--pad min-h-0" />
          ))}
          {days.map((day) => (
            <div key={day.toISOString()} className={dayCellClass(day)}>
              {format(day, 'd')}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        compact
          ? 'flex min-h-0 flex-1 flex-col'
          : 'rounded-xl border border-border bg-card p-4 shadow-card',
      )}
    >
      {monthNav}
      <div className={cn('grid grid-cols-7 gap-0.5 text-center', compact ? 'text-[10px]' : 'text-xs')}>
        {weekdayLabels}
        {Array.from({ length: startPadding }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map((day) => (
          <div key={day.toISOString()} className={dayCellClass(day)}>
            {format(day, 'd')}
          </div>
        ))}
      </div>
    </div>
  )
}
