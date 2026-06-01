import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  formatDigitsAsDdMmYyyy,
  isoToDdMmYyyy,
  isIsoInRange,
  parseDdMmYyyy,
  validateIsoInRange,
} from '@/utils/dateValidation'

const CALENDAR_WIDTH = 280
const CALENDAR_HEIGHT_ESTIMATE = 340

export interface DateInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string
  onChange: (iso: string) => void
  minDate?: string
  maxDate?: string
  error?: string
  onValidationError?: (message: string) => void
  /** Show calendar popover for date picking (default: true) */
  withCalendar?: boolean
}

function useClickOutside(
  refs: React.RefObject<HTMLElement | null>[],
  handler: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return
    const listener = (e: MouseEvent) => {
      const target = e.target as Node
      if (refs.some((ref) => ref.current?.contains(target))) return
      handler()
    }
    document.addEventListener('mousedown', listener)
    return () => document.removeEventListener('mousedown', listener)
  }, [refs, handler, enabled])
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

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      value,
      onChange,
      minDate,
      maxDate,
      error,
      onValidationError,
      className,
      disabled,
      placeholder = 'dd/mm/yyyy',
      onBlur,
      withCalendar = true,
      ...props
    },
    ref,
  ) => {
    const [display, setDisplay] = useState(() => isoToDdMmYyyy(value))
    const [localError, setLocalError] = useState('')
    const [calendarOpen, setCalendarOpen] = useState(false)
    const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 })
    const [viewMonth, setViewMonth] = useState(() => {
      const base = value ? new Date(`${value}T12:00:00`) : new Date()
      return new Date(base.getFullYear(), base.getMonth(), 1)
    })
    const anchorRef = useRef<HTMLDivElement>(null)
    const popoverRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      setDisplay(isoToDdMmYyyy(value))
      if (value) {
        const d = new Date(`${value}T12:00:00`)
        setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1))
      }
    }, [value])

    const updatePopoverPosition = useCallback(() => {
      const anchor = anchorRef.current
      if (!anchor) return

      const rect = anchor.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const openAbove = spaceBelow < CALENDAR_HEIGHT_ESTIMATE && rect.top > CALENDAR_HEIGHT_ESTIMATE

      let top = openAbove ? rect.top - CALENDAR_HEIGHT_ESTIMATE - 8 : rect.bottom + 8
      let left = rect.left

      top = Math.max(8, Math.min(top, window.innerHeight - CALENDAR_HEIGHT_ESTIMATE - 8))
      left = Math.max(8, Math.min(left, window.innerWidth - CALENDAR_WIDTH - 8))

      setPopoverPos({ top, left })
    }, [])

    useLayoutEffect(() => {
      if (!calendarOpen) return
      updatePopoverPosition()
      window.addEventListener('resize', updatePopoverPosition)
      window.addEventListener('scroll', updatePopoverPosition, true)
      return () => {
        window.removeEventListener('resize', updatePopoverPosition)
        window.removeEventListener('scroll', updatePopoverPosition, true)
      }
    }, [calendarOpen, updatePopoverPosition])

    useClickOutside([anchorRef, popoverRef], () => setCalendarOpen(false), calendarOpen)

    const commitValue = (raw: string) => {
      if (!raw.trim()) {
        setLocalError('')
        onChange('')
        return
      }

      const parsed = parseDdMmYyyy(raw)
      if (!parsed.valid) {
        setLocalError(parsed.error)
        onValidationError?.(parsed.error)
        onChange('')
        return
      }

      const ranged = validateIsoInRange(parsed.iso, minDate, maxDate)
      if (!ranged.valid) {
        setLocalError(ranged.error)
        onValidationError?.(ranged.error)
        onChange('')
        return
      }

      setLocalError('')
      onChange(parsed.iso)
    }

    const selectIso = (iso: string) => {
      if (!isIsoInRange(iso, minDate, maxDate)) return
      setLocalError('')
      setDisplay(isoToDdMmYyyy(iso))
      onChange(iso)
      setCalendarOpen(false)
    }

    const openCalendar = () => {
      if (!withCalendar || disabled) return
      setCalendarOpen(true)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatDigitsAsDdMmYyyy(e.target.value)
      setDisplay(formatted)
      setLocalError('')

      if (formatted.length === 10) {
        commitValue(formatted)
      } else if (!formatted) {
        onChange('')
      }
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (display.trim()) {
        commitValue(display)
      }
      onBlur?.(e)
    }

    const calendarCells = useMemo(() => buildCalendarCells(viewMonth), [viewMonth])
    const shownError = error || localError

    const calendarPopover =
      withCalendar && calendarOpen && !disabled
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="Choose date"
              style={{
                position: 'fixed',
                top: popoverPos.top,
                left: popoverPos.left,
                width: CALENDAR_WIDTH,
                zIndex: 10000,
              }}
              className="rounded-xl border border-border bg-white p-3 shadow-xl ring-1 ring-black/10"
            >
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
                  const inRange = isIsoInRange(cell.dateString, minDate, maxDate)
                  const isSelected = value === cell.dateString
                  return (
                    <button
                      key={`${cell.dateString}-${cell.day}`}
                      type="button"
                      disabled={!inRange}
                      onClick={() => selectIso(cell.dateString)}
                      className={cn(
                        'flex h-8 w-full items-center justify-center rounded-lg text-xs font-medium transition-colors',
                        cell.isCurrentMonth ? 'text-ink' : 'text-muted/70',
                        inRange && !isSelected && 'hover:bg-primary/10 hover:text-primary',
                        isSelected && 'bg-primary text-white shadow-sm hover:bg-primary',
                        !inRange && 'cursor-not-allowed opacity-30',
                      )}
                    >
                      {cell.day}
                    </button>
                  )
                })}
              </div>

              {value ? (
                <button
                  type="button"
                  onClick={() => {
                    setDisplay('')
                    onChange('')
                    setCalendarOpen(false)
                  }}
                  className="mt-2 w-full rounded-lg py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-ink"
                >
                  Clear date
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null

    return (
      <div className="w-full min-w-[9.5rem]">
        <div ref={anchorRef} className="relative">
          <input
            ref={ref}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={placeholder}
            value={display}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={disabled}
            maxLength={10}
            aria-invalid={shownError ? true : undefined}
            onFocus={openCalendar}
            className={cn(
              'h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink shadow-sm outline-none transition-ui placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50',
              withCalendar && 'pr-9',
              shownError && 'border-danger focus:border-danger focus:ring-danger/20',
              className,
            )}
            {...props}
          />
          {withCalendar && !disabled ? (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (calendarOpen) {
                  setCalendarOpen(false)
                } else {
                  openCalendar()
                }
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-primary transition-colors hover:bg-primary/10"
              aria-label="Open calendar"
              aria-expanded={calendarOpen}
            >
              <Calendar className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {calendarPopover}

        {shownError ? <p className="mt-1 text-xs text-danger">{shownError}</p> : null}
      </div>
    )
  },
)
DateInput.displayName = 'DateInput'
