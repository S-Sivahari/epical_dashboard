import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  formatChartRangeLabel,
  formatDateKey,
  normalizeChartDateRange,
} from '@/pages/admin/Dashboard/dashboardChartUtils'
import { isIsoInRange } from '@/utils/dateValidation'
import { cn } from '@/utils/cn'

const CALENDAR_WIDTH = 300
const CALENDAR_HEIGHT_ESTIMATE = 360

function getPortalRoot(): HTMLElement {
  if (typeof document === 'undefined') {
    return null as unknown as HTMLElement
  }
  let root = document.getElementById('chart-date-range-portal')
  if (!root) {
    root = document.createElement('div')
    root.id = 'chart-date-range-portal'
    root.style.position = 'relative'
    root.style.zIndex = '2147483646'
    root.style.pointerEvents = 'none'
    document.body.appendChild(root)
  }
  return root
}

function buildCalendarCells(month: Date) {
  const year = month.getFullYear()
  const m = month.getMonth()
  const firstDayIndex = new Date(year, m, 1).getDay()
  const daysInMonth = new Date(year, m + 1, 0).getDate()
  const prevDaysInMonth = new Date(year, m, 0).getDate()
  const cells: { day: number; dateString: string; isCurrentMonth: boolean }[] = []

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const day = prevDaysInMonth - i
    const prevM = m === 0 ? 11 : m - 1
    const prevY = m === 0 ? year - 1 : year
    cells.push({
      day,
      dateString: `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      isCurrentMonth: false,
    })
  }

  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({
      day: i,
      dateString: `${year}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
      isCurrentMonth: true,
    })
  }

  const remaining = 42 - cells.length
  for (let i = 1; i <= remaining; i++) {
    const nextM = m === 11 ? 0 : m + 1
    const nextY = m === 11 ? year + 1 : year
    cells.push({
      day: i,
      dateString: `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
      isCurrentMonth: false,
    })
  }

  return cells
}

export function ChartDateRangePicker({
  from,
  to,
  onChange,
  maxDate,
  className,
  open: openProp,
  onOpenChange,
}: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
  maxDate?: string
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp ?? internalOpen
  const setOpen = useCallback(
    (next: boolean) => {
      onOpenChange?.(next)
      if (openProp === undefined) setInternalOpen(next)
    },
    [onOpenChange, openProp],
  )
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)
  const [selectingEnd, setSelectingEnd] = useState(false)
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 })
  const [viewMonth, setViewMonth] = useState(() => {
    const anchor = from || formatDateKey(new Date())
    const d = new Date(`${anchor}T12:00:00`)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const anchorRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const normalized = useMemo(() => normalizeChartDateRange(from, to), [from, to])
  const draftNormalized = useMemo(
    () => normalizeChartDateRange(draftFrom, draftTo),
    [draftFrom, draftTo],
  )

  useEffect(() => {
    if (!open) {
      setDraftFrom(from)
      setDraftTo(to)
      setSelectingEnd(false)
    }
  }, [from, to, open])

  const updatePopoverPosition = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return

    const rect = anchor.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const openAbove = spaceBelow < CALENDAR_HEIGHT_ESTIMATE && rect.top > CALENDAR_HEIGHT_ESTIMATE

    let top = openAbove ? rect.top - CALENDAR_HEIGHT_ESTIMATE - 8 : rect.bottom + 8
    let left = rect.right - CALENDAR_WIDTH

    top = Math.max(8, Math.min(top, window.innerHeight - CALENDAR_HEIGHT_ESTIMATE - 8))
    left = Math.max(8, Math.min(left, window.innerWidth - CALENDAR_WIDTH - 8))

    setPopoverPos({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePopoverPosition()
    window.addEventListener('resize', updatePopoverPosition)
    window.addEventListener('scroll', updatePopoverPosition, true)
    return () => {
      window.removeEventListener('resize', updatePopoverPosition)
      window.removeEventListener('scroll', updatePopoverPosition, true)
    }
  }, [open, updatePopoverPosition])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (anchorRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown, true)
    return () => document.removeEventListener('mousedown', onPointerDown, true)
  }, [open])

  const handleDayPick = (iso: string) => {
    if (!isIsoInRange(iso, undefined, maxDate)) return

    if (!selectingEnd) {
      setDraftFrom(iso)
      setDraftTo(iso)
      setSelectingEnd(true)
      return
    }

    const next = normalizeChartDateRange(draftFrom, iso)
    setDraftFrom(next.from)
    setDraftTo(next.to)
    onChange(next.from, next.to)
    setSelectingEnd(false)
    setOpen(false)
  }

  const calendarCells = useMemo(() => buildCalendarCells(viewMonth), [viewMonth])

  const popover = open
    ? createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Choose date range"
          style={{
            position: 'fixed',
            top: popoverPos.top,
            left: popoverPos.left,
            width: CALENDAR_WIDTH,
            pointerEvents: 'auto',
          }}
          className="chart-date-range-popover z-[2147483647] rounded-xl border border-border bg-white p-3 shadow-xl ring-1 ring-black/10"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-600">
              {selectingEnd ? 'Select end date' : 'Select start date'}
            </p>
            <p className="truncate text-xs font-medium text-[#266b1c]">
              {formatChartRangeLabel(draftNormalized.from, draftNormalized.to)}
            </p>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
              className="rounded-lg p-1 text-muted transition-colors hover:bg-surface hover:text-ink"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-ink">
              {viewMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
              className="rounded-lg p-1 text-muted transition-colors hover:bg-surface hover:text-ink"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <span key={d} className="py-1">
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {calendarCells.map((cell) => {
              const inRange = isIsoInRange(cell.dateString, undefined, maxDate)
              const isInSelectedRange =
                draftNormalized.from &&
                cell.dateString >= draftNormalized.from &&
                cell.dateString <= draftNormalized.end
              const isRangeStart = cell.dateString === draftNormalized.from
              const isRangeEnd = cell.dateString === draftNormalized.to
              const isSingleDay = isRangeStart && isRangeEnd

              return (
                <button
                  key={`${cell.dateString}-${cell.day}`}
                  type="button"
                  disabled={!inRange}
                  onClick={() => handleDayPick(cell.dateString)}
                  className={cn(
                    'mx-auto flex h-8 w-8 items-center justify-center text-xs font-medium transition-colors',
                    cell.isCurrentMonth ? 'text-ink' : 'text-muted/70',
                    inRange && !isInSelectedRange && 'rounded-full hover:bg-emerald-50 hover:text-[#266b1c]',
                    isInSelectedRange &&
                      !isSingleDay &&
                      'rounded-none bg-emerald-100 font-medium text-[#266b1c]',
                    isRangeStart && !isSingleDay && 'rounded-l-full',
                    isRangeEnd && !isSingleDay && 'rounded-r-full',
                    isSingleDay && 'rounded-full bg-[#266b1c] font-semibold text-white shadow-md',
                    !inRange && 'cursor-not-allowed opacity-30',
                  )}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>

          <p className="mt-2 text-center text-[10px] text-muted">
            Click a start date, then click an end date
          </p>
        </div>,
        getPortalRoot(),
      )
    : null

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'dashboard-period-btn chart-date-range-trigger flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold',
          className,
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Calendar className="h-4 w-4 shrink-0 opacity-90" />
        <span className="max-w-[11rem] truncate">{formatChartRangeLabel(normalized.from, normalized.to)}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {popover}
    </>
  )
}
