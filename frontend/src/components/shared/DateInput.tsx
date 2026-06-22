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

function getDatePickerPortalRoot(): HTMLElement {
  if (typeof document === 'undefined') {
    return null as unknown as HTMLElement
  }
  let root = document.getElementById('date-picker-portal-root')
  if (!root) {
    root = document.createElement('div')
    root.id = 'date-picker-portal-root'
    root.setAttribute('data-date-input-popover', '')
    root.style.position = 'relative'
    root.style.zIndex = '2147483646'
    root.style.pointerEvents = 'none'
    document.body.appendChild(root)
  }
  return root
}

/** Matches admin "Save Holiday" / primary button green */
const SELECTED_DAY_CLASS =
  'rounded-full bg-[#266b1c] font-semibold text-white shadow-md ring-2 ring-[#266b1c]/25 hover:bg-[#1f5516]'

export type DateInputBaseProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'readOnly'
> & {
  minDate?: string
  maxDate?: string
  error?: string
  onValidationError?: (message: string) => void
  /** Show calendar popover for date picking (default: true) */
  withCalendar?: boolean
}

export type DateInputSingleProps = DateInputBaseProps & {
  selectionMode?: 'single'
  value: string
  onChange: (iso: string) => void
}

export type DateInputRangeProps = DateInputBaseProps & {
  selectionMode: 'range'
  rangeFrom: string
  rangeTo: string
  onRangeChange: (from: string, to: string) => void
}

export type DateInputProps = DateInputSingleProps | DateInputRangeProps

function isRangeDateInputProps(props: DateInputProps): props is DateInputRangeProps {
  return props.selectionMode === 'range'
}

function isInsideDatePicker(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest('[data-date-input-popover]') ||
      target.closest('#date-picker-portal-root'),
  )
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
      if (isInsideDatePicker(target)) return
      handler()
    }
    document.addEventListener('mousedown', listener, true)
    return () => document.removeEventListener('mousedown', listener, true)
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

function normalizeIsoRange(from: string, to: string) {
  if (!from) return { start: '', end: '' }
  const end = to || from
  return from <= end ? { start: from, end } : { start: end, end: from }
}

function formatRangeDisplay(from: string, to: string) {
  if (!from) return ''
  const fromDisplay = isoToDdMmYyyy(from)
  const toDisplay = isoToDdMmYyyy(to || from)
  if (!to || from === to) return fromDisplay
  return `${fromDisplay} – ${toDisplay}`
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  (props, ref) => {
    const isRangeMode = isRangeDateInputProps(props)
    const value = isRangeMode ? '' : props.value
    const onChange = isRangeMode ? () => {} : props.onChange
    const rangeFrom = isRangeMode ? props.rangeFrom : ''
    const rangeTo = isRangeMode ? props.rangeTo : ''
    const onRangeChange = isRangeMode ? props.onRangeChange : undefined

    const {
      minDate,
      maxDate,
      error,
      onValidationError,
      className,
      disabled,
      placeholder = isRangeMode ? 'Select dates…' : 'dd/mm/yyyy',
      onBlur,
      withCalendar = true,
      selectionMode: _selectionMode,
      value: _value,
      onChange: _onChange,
      rangeFrom: _rangeFrom,
      rangeTo: _rangeTo,
      onRangeChange: _onRangeChange,
      ...restProps
    } = props as DateInputBaseProps & {
      selectionMode?: 'single' | 'range'
      value?: string
      onChange?: (iso: string) => void
      rangeFrom?: string
      rangeTo?: string
      onRangeChange?: (from: string, to: string) => void
    }
    /** ISO yyyy-mm-dd — drives highlight + input display while picker is open */
    const [selectedDate, setSelectedDate] = useState(value)
    const [display, setDisplay] = useState(() =>
      isRangeMode ? formatRangeDisplay(rangeFrom, rangeTo) : isoToDdMmYyyy(value),
    )
    const [localError, setLocalError] = useState('')
    const [calendarOpen, setCalendarOpen] = useState(false)
    const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 })
    const [rangeAnchor, setRangeAnchor] = useState('')
    const [viewMonth, setViewMonth] = useState(() => {
      const anchorIso = isRangeMode ? rangeFrom : value
      const base = anchorIso ? new Date(`${anchorIso}T12:00:00`) : new Date()
      return new Date(base.getFullYear(), base.getMonth(), 1)
    })
    const anchorRef = useRef<HTMLDivElement>(null)
    const popoverRef = useRef<HTMLDivElement>(null)
    const selectingFromCalendarRef = useRef(false)

    useEffect(() => {
      if (isRangeMode) {
        setDisplay(formatRangeDisplay(rangeFrom, rangeTo))
        if (rangeFrom) {
          const d = new Date(`${rangeFrom}T12:00:00`)
          setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1))
        }
        return
      }

      setSelectedDate(value)
      setDisplay(isoToDdMmYyyy(value))
      if (value) {
        const d = new Date(`${value}T12:00:00`)
        setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1))
      }
    }, [isRangeMode, rangeFrom, rangeTo, value])

    useEffect(() => {
      if (calendarOpen && isRangeMode) {
        setRangeAnchor(rangeFrom || '')
      }
    }, [calendarOpen, isRangeMode, rangeFrom])

    const normalizedRange = useMemo(
      () => normalizeIsoRange(rangeFrom, rangeTo),
      [rangeFrom, rangeTo],
    )

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

    useClickOutside(
      [anchorRef, popoverRef],
      () => {
        if (selectingFromCalendarRef.current) return
        setCalendarOpen(false)
      },
      calendarOpen,
    )

    const commitValue = (raw: string) => {
      if (!raw.trim()) {
        setLocalError('')
        setSelectedDate('')
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
      setSelectedDate(parsed.iso)
      onChange(parsed.iso)
    }

    const selectIso = (iso: string) => {
      if (!isIsoInRange(iso, minDate, maxDate)) return

      selectingFromCalendarRef.current = true
      setLocalError('')
      setSelectedDate(iso)
      setDisplay(isoToDdMmYyyy(iso))
      onChange(iso)
      setCalendarOpen(false)

      window.setTimeout(() => {
        selectingFromCalendarRef.current = false
      }, 150)
    }

    const openCalendar = () => {
      if (!withCalendar || disabled) return
      setCalendarOpen(true)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isRangeMode) return

      const formatted = formatDigitsAsDdMmYyyy(e.target.value)
      setDisplay(formatted)
      setLocalError('')

      if (formatted.length === 10) {
        commitValue(formatted)
      } else if (!formatted) {
        setSelectedDate('')
        onChange('')
      }
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (isRangeMode) {
        onBlur?.(e)
        return
      }

      if (selectingFromCalendarRef.current) return
      if (isInsideDatePicker(e.relatedTarget)) return
      if (display.trim()) {
        commitValue(display)
      }
      onBlur?.(e)
    }

    const calendarCells = useMemo(() => buildCalendarCells(viewMonth), [viewMonth])
    const shownError = error || localError

    const handleDayPick = (iso: string, inRange: boolean, event?: React.MouseEvent) => {
      if (!inRange) return

      if (isRangeMode && onRangeChange) {
        if (event?.shiftKey) {
          const anchor = rangeAnchor || rangeFrom
          if (anchor) {
            const from = anchor <= iso ? anchor : iso
            const to = anchor <= iso ? iso : anchor
            onRangeChange(from, to)
            setRangeAnchor('')
            return
          }
        }

        const hasCompleteRange =
          Boolean(normalizedRange.start) &&
          Boolean(normalizedRange.end) &&
          normalizedRange.start !== normalizedRange.end

        const awaitingEndDate =
          Boolean(rangeAnchor) &&
          Boolean(rangeFrom) &&
          (!rangeTo || rangeFrom === rangeTo) &&
          !hasCompleteRange

        if (awaitingEndDate) {
          const from = rangeAnchor <= iso ? rangeAnchor : iso
          const to = rangeAnchor <= iso ? iso : rangeAnchor
          onRangeChange(from, to)
          setRangeAnchor('')
          return
        }

        setRangeAnchor(iso)
        onRangeChange(iso, iso)
        return
      }

      selectIso(iso)
    }

    const clearSelection = () => {
      if (isRangeMode && onRangeChange) {
        setRangeAnchor('')
        onRangeChange('', '')
        setCalendarOpen(false)
        return
      }

      setSelectedDate('')
      setDisplay('')
      onChange('')
      setCalendarOpen(false)
    }

    const hasSelection = isRangeMode ? Boolean(rangeFrom) : Boolean(selectedDate)

    const calendarPopover =
      withCalendar && calendarOpen && !disabled
        ? createPortal(
            <div
              ref={popoverRef}
              data-date-input-popover
              role="dialog"
              aria-label={isRangeMode ? 'Choose date range' : 'Choose date'}
              style={{
                position: 'fixed',
                top: popoverPos.top,
                left: popoverPos.left,
                width: CALENDAR_WIDTH,
                pointerEvents: 'auto',
              }}
              className="z-[2147483647] rounded-xl border border-border bg-white p-3 shadow-xl ring-1 ring-black/10"
              onPointerDown={(e) => e.stopPropagation()}
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
                  const isSelected = !isRangeMode && selectedDate === cell.dateString
                  const isInSelectedRange =
                    isRangeMode &&
                    normalizedRange.start &&
                    cell.dateString >= normalizedRange.start &&
                    cell.dateString <= normalizedRange.end
                  const isRangeStart = isRangeMode && cell.dateString === normalizedRange.start
                  const isRangeEnd = isRangeMode && cell.dateString === normalizedRange.end
                  const isSingleDayRange = isRangeStart && isRangeEnd

                  return (
                    <button
                      key={`${cell.dateString}-${cell.day}`}
                      type="button"
                      tabIndex={0}
                      disabled={!inRange}
                      aria-pressed={Boolean(isSelected || isInSelectedRange)}
                      aria-label={cell.dateString}
                      onPointerDown={
                        isRangeMode
                          ? undefined
                          : (e) => {
                              e.stopPropagation()
                              handleDayPick(cell.dateString, inRange)
                            }
                      }
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDayPick(cell.dateString, inRange, e)
                      }}
                      className={cn(
                        'pointer-events-auto',
                        'mx-auto flex h-8 w-8 items-center justify-center text-xs font-medium transition-colors',
                        cell.isCurrentMonth ? 'text-ink' : 'text-muted/70',
                        inRange &&
                          !isSelected &&
                          !isInSelectedRange &&
                          'rounded-full hover:bg-emerald-50 hover:text-[#266b1c]',
                        isSelected && SELECTED_DAY_CLASS,
                        isInSelectedRange &&
                          !isSingleDayRange &&
                          'rounded-none bg-emerald-100 font-medium text-[#266b1c]',
                        isRangeStart && !isSingleDayRange && 'rounded-l-full',
                        isRangeEnd && !isSingleDayRange && 'rounded-r-full',
                        isSingleDayRange && SELECTED_DAY_CLASS,
                        !inRange && 'cursor-not-allowed opacity-30',
                      )}
                    >
                      {cell.day}
                    </button>
                  )
                })}
              </div>

              {isRangeMode ? (
                <p className="mt-2 text-center text-[10px] text-muted">
                  Click a start date, then click an end date
                </p>
              ) : null}

              {hasSelection ? (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="mt-2 w-full rounded-lg py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-ink"
                >
                  {isRangeMode ? 'Clear dates' : 'Clear date'}
                </button>
              ) : null}
            </div>,
            getDatePickerPortalRoot(),
          )
        : null

    return (
      <div className={cn(isRangeMode ? 'w-[14rem] shrink-0' : 'w-full min-w-[9.5rem]')}>
        <div ref={anchorRef} className="relative">
          <input
            ref={ref}
            type="text"
            inputMode={isRangeMode ? undefined : 'numeric'}
            autoComplete="off"
            placeholder={placeholder}
            value={display}
            title={isRangeMode && display ? display : undefined}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={disabled}
            readOnly={isRangeMode}
            maxLength={isRangeMode ? undefined : 10}
            aria-invalid={shownError ? true : undefined}
            onFocus={openCalendar}
            className={cn(
              'h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink shadow-sm outline-none transition-ui placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50',
              withCalendar && 'pr-9',
              isRangeMode && 'cursor-pointer',
              shownError && 'border-danger focus:border-danger focus:ring-danger/20',
              className,
            )}
            {...restProps}
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
