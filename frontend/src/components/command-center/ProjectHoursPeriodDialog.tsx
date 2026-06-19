import { useEffect, useMemo, useState } from 'react'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import {
  formatChartSelectionLabel,
  formatDateKey,
  getQuickFilterDateRange,
  getRangeFromSelectedDays,
  getRangeFromSelectedMonths,
  getRangeFromSelectedYears,
  isMonthKeySelectable,
  normalizeChartDateRange,
  resolveChartBucketKind,
  toMonthKey,
  type ChartDateRange,
  type ChartSelectionMode,
} from '@/pages/admin/Dashboard/dashboardChartUtils'
import { isIsoInRange } from '@/utils/dateValidation'
import { cn } from '@/utils/cn'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const TABS: { id: ChartSelectionMode; label: string }[] = [
  { id: 'days', label: 'Days' },
  { id: 'months', label: 'Months' },
  { id: 'years', label: 'Years' },
]

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

type DayPickMode = 'individual' | 'continuous'

export function ProjectHoursPeriodDialog({
  open,
  onClose,
  value,
  maxDate,
  onApply,
}: {
  open: boolean
  onClose: () => void
  value: ChartDateRange
  maxDate: string
  onApply: (range: ChartDateRange) => void
}) {
  const maxYear = Number(maxDate.slice(0, 4))

  const [activeTab, setActiveTab] = useState<ChartSelectionMode>(
    value.selectionMode && value.selectionMode !== 'preset' ? value.selectionMode : 'days',
  )
  const [dayPickMode, setDayPickMode] = useState<DayPickMode>(
    value.dayRangeMode === 'continuous' ? 'continuous' : 'individual',
  )
  const [draftDays, setDraftDays] = useState<string[]>(value.selectedDays ?? [])
  const [draftMonths, setDraftMonths] = useState<string[]>(value.selectedMonths ?? [])
  const [draftYears, setDraftYears] = useState<string[]>(value.selectedYears ?? [])
  const [draftFrom, setDraftFrom] = useState(value.from)
  const [draftTo, setDraftTo] = useState(value.to)
  const [rangeAnchor, setRangeAnchor] = useState('')
  const [viewMonth, setViewMonth] = useState(() => {
    const anchor = value.from || formatDateKey(new Date())
    const d = new Date(`${anchor}T12:00:00`)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [viewYear, setViewYear] = useState(() => {
    const anchor = value.from || formatDateKey(new Date())
    return new Date(`${anchor}T12:00:00`).getFullYear()
  })

  useEffect(() => {
    if (!open) return
    setActiveTab(value.selectionMode && value.selectionMode !== 'preset' ? value.selectionMode : 'days')
    setDayPickMode(value.dayRangeMode === 'continuous' ? 'continuous' : 'individual')
    setDraftDays(value.selectedDays ?? [])
    setDraftMonths(value.selectedMonths ?? [])
    setDraftYears(value.selectedYears ?? [])
    setDraftFrom(value.from)
    setDraftTo(value.to)
    setRangeAnchor('')
    if (value.from) {
      const d = new Date(`${value.from}T12:00:00`)
      setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1))
      setViewYear(d.getFullYear())
    }
  }, [open, value])

  const draftRange = useMemo(() => {
    if (activeTab === 'days' && dayPickMode === 'individual' && draftDays.length > 0) {
      return getRangeFromSelectedDays(draftDays)
    }
    if (activeTab === 'months' && draftMonths.length > 0) {
      return getRangeFromSelectedMonths(draftMonths)
    }
    if (activeTab === 'years' && draftYears.length > 0) {
      return getRangeFromSelectedYears(draftYears, maxDate)
    }
    const normalized = normalizeChartDateRange(draftFrom, draftTo)
    return {
      ...normalized,
      selectionMode: activeTab,
      dayRangeMode: activeTab === 'days' ? dayPickMode : undefined,
      selectedDays: activeTab === 'days' && dayPickMode === 'individual' ? draftDays : undefined,
      selectedMonths: activeTab === 'months' ? draftMonths : undefined,
      selectedYears: activeTab === 'years' ? draftYears : undefined,
      preset: undefined,
    } satisfies ChartDateRange
  }, [activeTab, dayPickMode, draftDays, draftMonths, draftYears, draftFrom, draftTo, maxDate])

  const bucketKind = resolveChartBucketKind(draftRange)
  const calendarCells = useMemo(() => buildCalendarCells(viewMonth), [viewMonth])
  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, i) => String(maxYear - 5 + i)).filter((y) => Number(y) <= maxYear),
    [maxYear],
  )

  const clearExplicit = () => {
    setDraftDays([])
    setDraftMonths([])
    setDraftYears([])
    setRangeAnchor('')
  }

  const handlePreset = (filter: 'This Week' | 'This Month' | 'This Year') => {
    onApply(getQuickFilterDateRange(filter))
    onClose()
  }

  const handleTabChange = (tab: ChartSelectionMode) => {
    setActiveTab(tab)
    clearExplicit()
    setDraftFrom('')
    setDraftTo('')
  }

  const handleDayToggle = (iso: string) => {
    if (!isIsoInRange(iso, undefined, maxDate)) return
    setDraftDays((prev) => {
      const next = prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso]
      if (next.length > 0) {
        const range = getRangeFromSelectedDays(next)
        setDraftFrom(range.from)
        setDraftTo(range.to)
      }
      return next
    })
  }

  const handleDayRangePick = (iso: string) => {
    if (!isIsoInRange(iso, undefined, maxDate)) return
    if (!rangeAnchor) {
      setRangeAnchor(iso)
      setDraftFrom(iso)
      setDraftTo(iso)
      return
    }
    const next = normalizeChartDateRange(rangeAnchor, iso)
    setDraftFrom(next.from)
    setDraftTo(next.to)
    setDraftDays([])
    setRangeAnchor('')
  }

  const handleMonthToggle = (monthIndex: number) => {
    const monthKey = toMonthKey(viewYear, monthIndex)
    if (!isMonthKeySelectable(monthKey, maxDate)) return
    setDraftMonths((prev) => {
      const next = prev.includes(monthKey) ? prev.filter((k) => k !== monthKey) : [...prev, monthKey]
      if (next.length > 0) {
        const range = getRangeFromSelectedMonths(next)
        setDraftFrom(range.from)
        setDraftTo(range.to)
      }
      return next
    })
  }

  const handleYearToggle = (year: string) => {
    if (Number(year) > maxYear) return
    setDraftYears((prev) => {
      const next = prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
      if (next.length > 0) {
        const range = getRangeFromSelectedYears(next, maxDate)
        setDraftFrom(range.from)
        setDraftTo(range.to)
      }
      return next
    })
  }

  const handleApply = () => {
    if (!draftRange.from || !draftRange.to) return
    onApply(draftRange)
    onClose()
  }

  const canApply = Boolean(draftRange.from && draftRange.to)

  return (
    <Modal isOpen={open} onClose={onClose} title="Select period" size="md" modal className="project-hours-period-dialog">
      <div className="project-hours-period-dialog__layout">
        <p className="project-hours-period-dialog__intro">
          Use quick select, or pick specific days, months, or years — continuous or not.
        </p>
        <div className="project-hours-period-dialog__shortcuts">
          <button type="button" className="project-hours-period-dialog__shortcut" onClick={() => handlePreset('This Week')}>
            This Week
          </button>
          <button type="button" className="project-hours-period-dialog__shortcut" onClick={() => handlePreset('This Month')}>
            This Month
          </button>
          <button type="button" className="project-hours-period-dialog__shortcut" onClick={() => handlePreset('This Year')}>
            This Year
          </button>
        </div>

        <div className="project-hours-period-dialog__tabs" role="tablist">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              className={cn('project-hours-period-dialog__tab', activeTab === id && 'is-active')}
              onClick={() => handleTabChange(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="project-hours-period-dialog__panel">
          {activeTab === 'days' && (
            <>
              <div className="project-hours-period-dialog__subtabs">
                <button
                  type="button"
                  className={cn('project-hours-period-dialog__subtab', dayPickMode === 'individual' && 'is-active')}
                  onClick={() => {
                    setDayPickMode('individual')
                    setRangeAnchor('')
                  }}
                >
                  Pick days
                </button>
                <button
                  type="button"
                  className={cn('project-hours-period-dialog__subtab', dayPickMode === 'continuous' && 'is-active')}
                  onClick={() => {
                    setDayPickMode('continuous')
                    setDraftDays([])
                    setRangeAnchor('')
                  }}
                >
                  Date range
                </button>
              </div>

              <div className="project-hours-period-dialog__calendar">
                <div className="project-hours-period-dialog__calendar-nav">
                  <button
                    type="button"
                    onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
                    className="project-hours-period-dialog__nav-btn"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="project-hours-period-dialog__month-label">
                    {viewMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                    className="project-hours-period-dialog__nav-btn"
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <p className="project-hours-period-dialog__hint">
                  {dayPickMode === 'individual'
                    ? 'Click days to select — non-continuous days are supported'
                    : rangeAnchor
                      ? 'Select end date'
                      : 'Select start date'}
                </p>

                <div className="project-hours-period-dialog__weekdays">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>

                <div className="project-hours-period-dialog__days">
                  {calendarCells.map((cell) => {
                    const selectable = isIsoInRange(cell.dateString, undefined, maxDate)
                    const isSelectedDay = draftDays.includes(cell.dateString)
                    const normalized = normalizeChartDateRange(draftFrom, draftTo)
                    const inContinuousRange =
                      dayPickMode === 'continuous' &&
                      normalized.from &&
                      cell.dateString >= normalized.from &&
                      cell.dateString <= normalized.to

                    return (
                      <button
                        key={`${cell.dateString}-${cell.day}`}
                        type="button"
                        disabled={!selectable}
                        onClick={() =>
                          dayPickMode === 'individual'
                            ? handleDayToggle(cell.dateString)
                            : handleDayRangePick(cell.dateString)
                        }
                        className={cn(
                          'project-hours-period-dialog__day',
                          !cell.isCurrentMonth && 'is-muted',
                          isSelectedDay && 'is-selected',
                          inContinuousRange && 'is-in-range',
                          !selectable && 'is-disabled',
                        )}
                      >
                        {cell.day}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {activeTab === 'months' && (
            <>
              <div className="project-hours-period-dialog__calendar-nav">
                <button type="button" onClick={() => setViewYear((y) => y - 1)} className="project-hours-period-dialog__nav-btn" aria-label="Previous year">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="project-hours-period-dialog__month-label">{viewYear}</span>
                <button type="button" onClick={() => setViewYear((y) => y + 1)} className="project-hours-period-dialog__nav-btn" aria-label="Next year">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <p className="project-hours-period-dialog__hint">Select one or more months — continuous or non-continuous</p>
              <div className="project-hours-period-dialog__months-grid">
                {MONTH_LABELS.map((label, monthIndex) => {
                  const monthKey = toMonthKey(viewYear, monthIndex)
                  const selectable = isMonthKeySelectable(monthKey, maxDate)
                  return (
                    <button
                      key={monthKey}
                      type="button"
                      disabled={!selectable}
                      onClick={() => handleMonthToggle(monthIndex)}
                      className={cn(
                        'project-hours-period-dialog__month-tile',
                        draftMonths.includes(monthKey) && 'is-active',
                        !selectable && 'is-disabled',
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {activeTab === 'years' && (
            <>
              <p className="project-hours-period-dialog__hint">Select one or more years to compare</p>
              <div className="project-hours-period-dialog__years-grid">
                {yearOptions.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => handleYearToggle(year)}
                    className={cn(
                      'project-hours-period-dialog__year-tile',
                      draftYears.includes(year) && 'is-active',
                    )}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="project-hours-period-dialog__summary">
          <div>
            <p className="project-hours-period-dialog__summary-label">Selection</p>
            <p className="project-hours-period-dialog__summary-value">{formatChartSelectionLabel(draftRange)}</p>
          </div>
          <div className="project-hours-period-dialog__summary-meta">
            Chart groups by <strong>{bucketKind}</strong>
          </div>
        </div>

        <div className="project-hours-period-dialog__actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleApply} disabled={!canApply}>
            Apply
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function ProjectHoursPeriodTrigger({
  range,
  onClick,
  className,
}: {
  range: ChartDateRange
  onClick: () => void
  className?: string
}) {
  const rangeLabel = formatChartSelectionLabel(range)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'dashboard-period-btn chart-date-range-trigger flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold',
        className,
      )}
      aria-haspopup="dialog"
      aria-label={`Period, ${rangeLabel}`}
      title={rangeLabel}
    >
      <Calendar className="h-4 w-4 shrink-0 opacity-90" />
      <span>Period</span>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-80" />
    </button>
  )
}
