import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate } from '@/utils/formatDate'
import { getPresetDateRange } from '@pages/employee/lib/dateFilters'

const QUICK_PRESETS = [
  'Today',
  'Yesterday',
  'This Week',
  'Last Week',
  'Past Two Weeks',
  'This Month',
  'Last Month',
  'This Year',
  'Last Year',
]

function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return
      handler()
    }
    document.addEventListener('mousedown', listener)
    return () => document.removeEventListener('mousedown', listener)
  }, [ref, handler])
}

export function DateRangePicker({ startDate, endDate, preset, onChange }) {
  const [open, setOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => new Date(`${startDate}T12:00:00`))
  const [tempStart, setTempStart] = useState(startDate)
  const [tempEnd, setTempEnd] = useState(endDate)
  const containerRef = useRef(null)

  useClickOutside(containerRef, () => {
    setOpen(false)
    setTempStart(startDate)
    setTempEnd(endDate)
  })

  useEffect(() => {
    if (open) {
      setTempStart(startDate)
      setTempEnd(endDate)
      setCurrentMonth(new Date(`${startDate}T12:00:00`))
    }
  }, [open, startDate, endDate])

  const applySingleDay = (dateStr) => {
    setTempStart(dateStr)
    setTempEnd(dateStr)
    onChange(dateStr, dateStr, 'Custom')
    setOpen(false)
  }

  const applyRange = (start, end) => {
    setTempStart(start)
    setTempEnd(end)
    onChange(start, end, 'Custom')
    setOpen(false)
  }

  const handlePresetClick = (p) => {
    const { start, end } = getPresetDateRange(p)
    onChange(start, end, p)
    setOpen(false)
  }

  const handleDayClick = (dateStr, e) => {
    if (e.shiftKey) {
      if (!tempStart || (tempStart && tempEnd)) {
        setTempStart(dateStr)
        setTempEnd(null)
        return
      }
      const start = dateStr < tempStart ? dateStr : tempStart
      const end = dateStr < tempStart ? tempStart : dateStr
      applyRange(start, end)
      return
    }
    applySingleDay(dateStr)
  }

  const calendarCells = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDayIndex = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const prevDaysInMonth = new Date(year, month, 0).getDate()
    const cells = []

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const day = prevDaysInMonth - i
      const prevM = month === 0 ? 11 : month - 1
      const prevY = month === 0 ? year - 1 : year
      cells.push({
        day,
        dateString: `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        isCurrentMonth: false,
      })
    }

    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({
        day: i,
        dateString: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        isCurrentMonth: true,
      })
    }

    const remaining = 42 - cells.length
    for (let i = 1; i <= remaining; i++) {
      const nextM = month === 11 ? 0 : month + 1
      const nextY = month === 11 ? year + 1 : year
      cells.push({
        day: i,
        dateString: `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        isCurrentMonth: false,
      })
    }

    return cells
  }, [currentMonth])

  const label =
    preset === 'Custom' && startDate === endDate
      ? formatDate(startDate)
      : preset === 'Custom'
        ? `${formatDate(startDate)} – ${formatDate(endDate)}`
        : `${preset} (${formatDate(startDate)} – ${formatDate(endDate)})`

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-slate-50"
      >
        <Calendar className="h-4 w-4 text-primary" />
        {label}
        <ChevronDown className="h-3.5 w-3.5 text-muted" />
      </button>

      {open && (
        <div className="date-range-popover absolute right-0 top-full z-50 mt-2 flex w-[92vw] flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-xl sm:w-auto sm:min-w-[500px] md:flex-row">
          <div className="flex-1 select-none">
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
                }
                className="rounded-lg p-1 text-muted hover:bg-slate-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="date-range-month-title type-calendar-month">
                {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
                }
                className="rounded-lg p-1 text-muted hover:bg-slate-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="type-calendar-weekday mb-1 grid grid-cols-7 gap-1 text-center">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <span key={d} className="py-1">
                  {d}
                </span>
              ))}
            </div>

            <div className="type-calendar-day grid grid-cols-7 gap-1 text-center">
              {calendarCells.map((cell, idx) => {
                const isSelectedStart = tempStart && cell.dateString === tempStart
                const isSelectedEnd = tempEnd && cell.dateString === tempEnd
                const isSingleDay =
                  tempStart && tempEnd && tempStart === tempEnd && cell.dateString === tempStart
                const isWithinRange =
                  tempStart &&
                  tempEnd &&
                  tempStart !== tempEnd &&
                  cell.dateString > tempStart &&
                  cell.dateString < tempEnd

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => handleDayClick(cell.dateString, e)}
                    className={`
                      flex h-7 w-7 items-center justify-center rounded-lg font-semibold transition-all
                      ${cell.isCurrentMonth ? 'text-foreground hover:bg-primary/10 hover:text-primary' : 'text-muted hover:bg-slate-100'}
                      ${isSingleDay || isSelectedStart || isSelectedEnd ? 'bg-primary text-white shadow-sm hover:bg-primary hover:text-white' : ''}
                      ${isWithinRange ? 'rounded-none bg-primary/10 text-primary' : ''}
                    `}
                  >
                    {cell.day}
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-[10px] font-medium text-muted">
              Click any date to filter that day. Hold Shift, click a start date, then another date for a custom range.
            </p>
          </div>

          <div className="hidden border-l border-border md:block" />

          <div className="flex w-full flex-col gap-0.5 md:w-36">
            <p className="type-card-label-caps mb-2 text-[9px]">Quick Presets</p>
            {QUICK_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePresetClick(p)}
                className={`
                  rounded-lg px-2.5 py-1 text-left text-xs font-semibold transition-all
                  ${preset === p ? 'bg-primary/10 font-bold text-primary' : 'text-muted hover:bg-slate-50 hover:text-foreground'}
                `}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
