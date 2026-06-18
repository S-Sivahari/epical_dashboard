import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate } from '@/utils/formatDate'
import { cn } from '@/utils/cn'
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

export function DateRangePicker({ startDate, endDate, preset, onChange }) {
  const [open, setOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => new Date(`${startDate}T12:00:00`))
  const [tempStart, setTempStart] = useState(startDate)
  const [tempEnd, setTempEnd] = useState(endDate)
  const [selectionMode, setSelectionMode] = useState(
    () => (preset === 'Custom' && startDate !== endDate ? 'range' : 'single'),
  )
  const containerRef = useRef(null)
  const calendarRef = useRef(null)
  const [calendarPosition, setCalendarPosition] = useState({ top: 0, left: 0 })

  const updateCalendarPosition = useCallback(() => {
    if (!containerRef.current || !open) return

    const rect = containerRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth
    const calendarHeight = 450
    const calendarWidth = 520

    let top = rect.bottom + 8
    let left = rect.right - calendarWidth

    if (top + calendarHeight > viewportHeight - 16) {
      top = Math.max(16, rect.top - calendarHeight - 8)
    }

    if (left < 16) {
      left = 16
    }

    if (left + calendarWidth > viewportWidth - 16) {
      left = viewportWidth - calendarWidth - 16
    }

    setCalendarPosition({ top, left })
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    updateCalendarPosition()
    window.addEventListener('scroll', updateCalendarPosition, true)
    window.addEventListener('resize', updateCalendarPosition)

    return () => {
      window.removeEventListener('scroll', updateCalendarPosition, true)
      window.removeEventListener('resize', updateCalendarPosition)
    }
  }, [open, updateCalendarPosition])

  useEffect(() => {
    if (!open) return undefined

    function handleClickOutside(e) {
      const target = e.target
      if (!(target instanceof Node)) return
      if (containerRef.current?.contains(target)) return
      if (calendarRef.current?.contains(target)) return
      setOpen(false)
      setTempStart(startDate)
      setTempEnd(endDate)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, startDate, endDate])

  useEffect(() => {
    if (open) {
      setTempStart(startDate)
      setTempEnd(endDate)
      setSelectionMode(preset === 'Custom' && startDate !== endDate ? 'range' : 'single')
      setCurrentMonth(new Date(`${startDate}T12:00:00`))
    }
  }, [open, startDate, endDate, preset])

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

  const handleDayClick = (dateStr) => {
    if (selectionMode === 'range') {
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

  const selectionHint =
    selectionMode === 'single'
      ? 'Click a date to filter that day.'
      : tempStart && !tempEnd
        ? 'Now click an end date.'
        : 'Click a start date, then click an end date.'

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

  const calendarPopover = open ? (
    <div
      ref={calendarRef}
      className="projects-date-calendar date-range-popover fixed z-[10000] flex w-[92vw] flex-col gap-3 rounded-2xl bg-[#f0f9f0] p-3 shadow-2xl sm:w-auto sm:min-w-[500px] md:flex-row md:p-4"
      style={{
        top: `${calendarPosition.top}px`,
        left: `${calendarPosition.left}px`,
      }}
    >
      <div className="flex-1 select-none">
        <div className="projects-date-calendar-header mb-3 flex items-center justify-between rounded-lg px-2 py-1.5">
          <button
            type="button"
            onClick={() =>
              setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
            }
            className="projects-date-nav-btn rounded-md p-1"
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
            className="projects-date-nav-btn rounded-md p-1"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="projects-date-mode-toggle mb-2.5 flex gap-1 rounded-lg border border-emerald-200/60 bg-white/60 p-0.5">
          <button
            type="button"
            onClick={() => {
              setSelectionMode('single')
              setTempStart(startDate)
              setTempEnd(endDate)
            }}
            className={cn(
              'flex-1 rounded-md px-2 py-1 text-[10px] font-bold transition-all',
              selectionMode === 'single' ? 'projects-date-preset-active' : '',
            )}
          >
            Single day
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectionMode('range')
              setTempStart(null)
              setTempEnd(null)
            }}
            className={cn(
              'flex-1 rounded-md px-2 py-1 text-[10px] font-bold transition-all',
              selectionMode === 'range' ? 'projects-date-preset-active' : '',
            )}
          >
            Date range
          </button>
        </div>

        <div className="projects-date-weekdays type-calendar-weekday mb-1.5 grid grid-cols-7 gap-1 text-center">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <span key={d} className="py-1">
              {d}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs">
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

            const todayStr = new Date().toISOString().split('T')[0]
            const isToday = cell.dateString === todayStr

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleDayClick(cell.dateString)}
                className={`
                      projects-date-day flex h-7 w-7 items-center justify-center rounded-lg font-semibold transition-all
                      ${cell.isCurrentMonth ? 'projects-date-day-current' : 'projects-date-day-muted'}
                      ${isSingleDay || isSelectedStart || isSelectedEnd ? 'projects-date-day-selected' : ''}
                      ${isWithinRange ? 'projects-date-day-in-range' : ''}
                      ${isToday && !(isSingleDay || isSelectedStart || isSelectedEnd) ? 'projects-date-day-today' : ''}
                    `}
              >
                {cell.day}
              </button>
            )
          })}
        </div>
        <p className="projects-date-hint mt-3 text-[10px] font-medium">
          {selectionHint}
        </p>
      </div>

      <div className="hidden border-l border-emerald-200/50 md:block" />

      <div className="projects-date-presets flex w-full flex-col gap-1 md:w-36">
        <p className="type-card-label-caps mb-2 text-[9px]">Quick Presets</p>
        {QUICK_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => handlePresetClick(p)}
            className={`
                  projects-date-preset rounded-lg px-2.5 py-1 text-left text-xs font-semibold transition-all
                  ${preset === p ? 'projects-date-preset-active font-bold' : ''}
                `}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  ) : null

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

      {calendarPopover ? createPortal(calendarPopover, document.body) : null}
    </div>
  )
}
