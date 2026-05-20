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

export function CalendarWidget({ holidays = [], highlightDates = [] }) {
  const [current, setCurrent] = useState(new Date())
  const monthStart = startOfMonth(current)
  const monthEnd = endOfMonth(current)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPadding = getDay(monthStart)

  const holidayDates = holidays.map((h) => h.date)
  const isHoliday = (day) => holidayDates.some((d) => isSameDay(new Date(d), day))
  const isHighlighted = (day) => highlightDates.some((d) => isSameDay(new Date(d), day))

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading font-semibold">{format(current, 'MMMM yyyy')}</h3>
        <div className="flex gap-1">
          <button type="button" onClick={() => setCurrent(subMonths(current, 1))} className="rounded-lg p-1.5 hover:bg-slate-100">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setCurrent(addMonths(current, 1))} className="rounded-lg p-1.5 hover:bg-slate-100">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="py-1 font-medium text-muted">
            {d}
          </div>
        ))}
        {Array.from({ length: startPadding }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              'flex h-8 items-center justify-center rounded-lg text-sm',
              !isSameMonth(day, current) && 'text-slate-300',
              isSameDay(day, new Date()) && 'bg-primary font-semibold text-white',
              isHoliday(day) && !isSameDay(day, new Date()) && 'bg-amber-100 text-amber-800',
              isHighlighted(day) && !isHoliday(day) && !isSameDay(day, new Date()) && 'bg-primary/10 text-primary'
            )}
          >
            {format(day, 'd')}
          </div>
        ))}
      </div>
    </div>
  )
}
