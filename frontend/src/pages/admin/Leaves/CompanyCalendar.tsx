import { useState, useMemo } from 'react'
import { useLeaves } from '@hooks/useLeaves'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
  isWithinInterval,
  parseISO,
} from 'date-fns'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Badge } from '@components/ui/Badge'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { DateInput } from '@components/shared/DateInput'
import { getCalendarEntryBounds, validateIsoInRange } from '@/utils/dateValidation'
import { Plus, Edit2, Trash2, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { formatDate } from '@/utils/formatDate'
import type { Holiday } from '@/types'
import { useLeaveStore } from '@store/leaveStore'
import { cn } from '@/utils/cn'

interface CalendarSidebarEvent {
  id: string
  title: string
  date: string
  time?: string
  description?: string
  holidayType?: Holiday['type']
}

interface CompanyCalendarProps {
  variant?: 'default' | 'admin'
}

type ViewPreset = 'today' | 'week' | 'month'

const VIEW_PRESET_OPTIONS: { id: ViewPreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
]

function isDateInRange(dateStr: string, start: string, end: string): boolean {
  const d = parseISO(dateStr)
  return isWithinInterval(d, { start: parseISO(start), end: parseISO(end) })
}

function leaveOverlapsRange(from: string, to: string, start: string, end: string): boolean {
  return from <= end && to >= start
}

export function CompanyCalendar({ variant = 'default' }: CompanyCalendarProps) {
  const isAdminCal = variant === 'admin'
  const { holidays, leaves, loading, companyCalendarEvents } = useLeaves()
  const addHoliday = useLeaveStore((s) => s.addHoliday)
  const updateHoliday = useLeaveStore((s) => s.updateHoliday)
  const deleteHoliday = useLeaveStore((s) => s.deleteHoliday)
  const fetchHolidays = useLeaveStore((s) => s.fetchHolidays)
  const deleteCompanyCalendarEvent = useLeaveStore((s) => s.deleteCompanyCalendarEvent)

  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewPreset, setViewPreset] = useState<ViewPreset>('month')
  const [eventDeleteConfirmOpen, setEventDeleteConfirmOpen] = useState(false)
  const [eventToDelete, setEventToDelete] = useState<CalendarSidebarEvent | null>(null)
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null)
  const [isDateModalOpen, setIsDateModalOpen] = useState(false)
  const [isHolidayFormOpen, setIsHolidayFormOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [holidayToDelete, setHolidayToDelete] = useState<Holiday | null>(null)

  const dbSidebarEvents = useMemo(
    (): CalendarSidebarEvent[] =>
      companyCalendarEvents.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        time: e.time,
        description: e.description,
      })),
    [companyCalendarEvents],
  )

  // Holiday form state
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'National' | 'Company' | 'Optional' | 'Company Event'>('National')

  // Calendar logic
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const applyViewPreset = (preset: ViewPreset) => {
    setViewPreset(preset)
    const now = new Date()
    setCurrentDate(preset === 'month' ? startOfMonth(now) : now)
  }

  const viewRange = useMemo(() => {
    const anchor = new Date()
    if (viewPreset === 'today') {
      const d = format(anchor, 'yyyy-MM-dd')
      return { start: d, end: d }
    }
    if (viewPreset === 'week') {
      const weekStart = startOfWeek(anchor, { weekStartsOn: 0 })
      const weekEnd = endOfWeek(anchor, { weekStartsOn: 0 })
      return {
        start: format(weekStart, 'yyyy-MM-dd'),
        end: format(weekEnd, 'yyyy-MM-dd'),
      }
    }
    return null
  }, [viewPreset])

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const leadingEmptyCells = monthStart.getDay()

  const currentMonthIdx = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  // Get approved leaves
  const approvedLeaves = useMemo(() => {
    return leaves.filter((l) => l.status === 'Approved')
  }, [leaves])

  const getHolidaysForDay = (dateStr: string) => holidays.filter((h) => h.date === dateStr)
  const getLeavesForDay = (dateStr: string) =>
    approvedLeaves.filter((l) => dateStr >= l.from && dateStr <= l.to)
  const getEventsForDay = (dateStr: string) => dbSidebarEvents.filter((e) => e.date === dateStr)

  const itemsOnSelectedDate = useMemo(() => {
    if (!selectedDateStr) return { leaves: [], holidays: [], events: [] }
    return {
      leaves: approvedLeaves.filter((l) => selectedDateStr >= l.from && selectedDateStr <= l.to),
      holidays: holidays.filter((h) => h.date === selectedDateStr),
      events: dbSidebarEvents.filter((e) => e.date === selectedDateStr),
    }
  }, [selectedDateStr, approvedLeaves, holidays, dbSidebarEvents])

  const handleDateClick = (dateStr: string) => {
    setSelectedDateStr(dateStr)
    setIsDateModalOpen(true)
  }

  const resetHolidayForm = () => {
    setTitle('')
    setDate('')
    setDescription('')
    setType('National')
    setEditingId(null)
  }

  const calendarBounds = getCalendarEntryBounds()

  const handleAddHoliday = async () => {
    if (!title.trim() || !date) {
      toast.error('Please fill holiday name and date')
      return
    }

    const dateCheck = validateIsoInRange(date, calendarBounds.min, calendarBounds.max)
    if (!dateCheck.valid) {
      toast.error(dateCheck.error)
      return
    }

    try {
      if (editingId) {
        await updateHoliday(editingId, { title, date, description, type })
      } else {
        await addHoliday({ title, date, description, type })
      }
      resetHolidayForm()
      setIsHolidayFormOpen(false)
      fetchHolidays()
    } catch {
      toast.error('Failed to save holiday')
    }
  }

  const handleEditHoliday = (holiday: Holiday) => {
    setTitle(holiday.title)
    setDate(holiday.date)
    setDescription(holiday.description || '')
    setType(holiday.type)
    setEditingId(holiday.id)
    setIsHolidayFormOpen(true)
  }

  const handleDeleteHoliday = async () => {
    if (!holidayToDelete) return
    try {
      await deleteHoliday(holidayToDelete.id)
      setDeleteConfirmOpen(false)
      setHolidayToDelete(null)
      fetchHolidays()
    } catch {
      toast.error('Failed to delete holiday')
    }
  }

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return
    if (eventToDelete.holidayType) {
      try {
        await deleteHoliday(eventToDelete.id)
        fetchHolidays()
      } catch {
        toast.error('Failed to delete event')
      }
    } else {
      try {
        await deleteCompanyCalendarEvent(eventToDelete.id)
      } catch {
        toast.error('Failed to remove event')
      }
    }
    setEventDeleteConfirmOpen(false)
    setEventToDelete(null)
  }

  const holidayEvents = useMemo((): CalendarSidebarEvent[] => {
    return holidays
      .filter((h) => h.type === 'Company Event')
      .map((h) => ({
        id: h.id,
        title: h.title,
        date: h.date,
        description: h.description,
        holidayType: h.type,
      }))
  }, [holidays])

  const currentMonthHolidays = useMemo(() => {
    return holidays.filter((h) => {
      if (h.type === 'Company Event') return false
      const holidayDate = new Date(h.date)
      return holidayDate.getMonth() === currentMonthIdx && holidayDate.getFullYear() === currentYear
    })
  }, [holidays, currentMonthIdx, currentYear])

  const currentMonthEvents = useMemo(() => {
    return [...dbSidebarEvents, ...holidayEvents].filter((e) => {
      const eventDate = new Date(e.date)
      return eventDate.getMonth() === currentMonthIdx && eventDate.getFullYear() === currentYear
    })
  }, [dbSidebarEvents, holidayEvents, currentMonthIdx, currentYear])

  const currentMonthLeaves = useMemo(() => {
    return approvedLeaves
      .filter((leave) => {
        const fromDate = new Date(leave.from)
        const toDate = new Date(leave.to)
        return (
          (fromDate.getMonth() === currentMonthIdx && fromDate.getFullYear() === currentYear) ||
          (toDate.getMonth() === currentMonthIdx && toDate.getFullYear() === currentYear) ||
          (fromDate < monthStart && toDate > monthEnd)
        )
      })
      .sort((a, b) => new Date(a.from).getTime() - new Date(b.from).getTime())
  }, [approvedLeaves, currentMonthIdx, currentYear, monthStart, monthEnd])

  const sidebarHolidays = useMemo(() => {
    if (!isAdminCal || !viewRange) return currentMonthHolidays
    return currentMonthHolidays.filter((h) => isDateInRange(h.date, viewRange.start, viewRange.end))
  }, [isAdminCal, viewRange, currentMonthHolidays])

  const sidebarEvents = useMemo(() => {
    if (!isAdminCal || !viewRange) return currentMonthEvents
    return currentMonthEvents.filter((e) => isDateInRange(e.date, viewRange.start, viewRange.end))
  }, [isAdminCal, viewRange, currentMonthEvents])

  const sidebarLeaves = useMemo(() => {
    if (!isAdminCal || !viewRange) return currentMonthLeaves
    return currentMonthLeaves.filter((l) =>
      leaveOverlapsRange(l.from, l.to, viewRange.start, viewRange.end),
    )
  }, [isAdminCal, viewRange, currentMonthLeaves])

  const viewPresetLabel = VIEW_PRESET_OPTIONS.find((o) => o.id === viewPreset)?.label ?? 'Today'

  return (
    <Tooltip.Provider delayDuration={300}>
      <div
        className={cn(isAdminCal && 'flex min-h-0 flex-1 flex-col')}
      >
      <div
        className={cn(
          'grid w-full gap-4 pb-4 pr-4 pl-0',
          isAdminCal
            ? 'admin-calendar-grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,18.5rem)]'
            : 'grid-cols-1 lg:grid-cols-3 xl:grid-cols-4',
        )}
      >

        {/* ── Left Column: Calendar Card ────────────────────────────── */}
        <div
          className={cn(
            'flex w-full min-w-0 flex-col',
            !isAdminCal && 'lg:col-span-2 xl:col-span-3',
            isAdminCal && 'admin-cal-main-col h-full min-h-0',
          )}
        >
          <div
            className={cn(
              'flex w-full flex-col overflow-hidden',
              isAdminCal
                ? 'admin-cal-main h-full min-h-0'
                : 'rounded-xl border border-border bg-white shadow-sm',
            )}
          >
            {/* Calendar Header */}
            <div className={cn(
              'p-3 flex items-center justify-between flex-shrink-0',
              isAdminCal ? 'admin-cal-header' : 'border-b border-border bg-surface/30',
            )}>
              <div className="flex items-center gap-2">
                <div className={cn(
                  'flex items-center gap-1 rounded-lg border p-0.5',
                  isAdminCal ? 'admin-cal-month-nav' : 'border-border bg-white',
                )}>
                  {isAdminCal ? (
                    <>
                      <button
                        type="button"
                        className="admin-cal-nav-btn"
                        onClick={prevMonth}
                        aria-label="Previous month"
                      >
                        <ChevronLeft className="admin-cal-nav-icon h-4 w-4" aria-hidden />
                      </button>
                      <span className="min-w-[7.5rem] px-2 text-center text-sm font-semibold text-white">
                        {format(currentDate, 'MMMM yyyy')}
                      </span>
                      <button
                        type="button"
                        className="admin-cal-nav-btn"
                        onClick={nextMonth}
                        aria-label="Next month"
                      >
                        <ChevronRight className="admin-cal-nav-icon h-4 w-4" aria-hidden />
                      </button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={prevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="min-w-[7.5rem] px-2 text-center text-sm font-semibold text-ink">
                        {format(currentDate, 'MMMM yyyy')}
                      </span>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={nextMonth}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
                {isAdminCal ? (
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-white/25 bg-emerald-900/40 px-2 text-[11px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-emerald-800/50"
                      >
                        <span>{viewPresetLabel}</span>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="z-[9999] min-w-[9.5rem] overflow-hidden rounded-lg border border-green-200/40 bg-emerald-50/90 p-1 shadow-md backdrop-blur-sm will-change-[opacity,transform]"
                        side="bottom"
                        sideOffset={6}
                        align="start"
                        collisionPadding={8}
                      >
                        {VIEW_PRESET_OPTIONS.map((option) => (
                          <DropdownMenu.Item
                            key={option.id}
                            className={cn(
                              'cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-semibold text-emerald-900 outline-none transition-colors',
                              viewPreset === option.id
                                ? 'bg-emerald-700 text-white data-[highlighted]:bg-emerald-700 data-[highlighted]:text-white'
                                : 'data-[highlighted]:bg-emerald-600/25 data-[highlighted]:text-emerald-950',
                            )}
                            onSelect={() => applyViewPreset(option.id)}
                          >
                            {option.label}
                          </DropdownMenu.Item>
                        ))}
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 px-3 text-xs"
                    onClick={() => applyViewPreset('today')}
                  >
                    Today
                  </Button>
                )}
              </div>
              <Button
                size="sm"
                className={cn('h-8 px-3 text-xs shadow-sm', isAdminCal && 'admin-dash-action-btn border-0')}
                onClick={() => setIsHolidayFormOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1.5" /> Add
              </Button>
            </div>

            {/* Legend */}
            <div className={cn(
              'px-3 py-1.5 flex flex-wrap gap-3 text-xs font-medium flex-shrink-0',
              isAdminCal ? 'admin-cal-legend' : 'border-b border-border bg-gray-50',
            )}>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-lime-400 border border-lime-500"></div>
                <span className="text-muted">Approved Leave</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                <span className="text-muted">Public Holiday</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                <span className="text-muted">Company Holiday</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                <span className="text-muted">Company Event</span>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className={cn('flex-1 min-h-0', isAdminCal ? 'admin-cal-grid-wrap p-1.5' : 'p-2.5')}>
              {loading ? (
                <div className="flex h-48 items-center justify-center">
                  <span className={cn('text-sm', isAdminCal ? 'text-[var(--emerald-dark)]/70' : 'text-muted')}>Loading calendar...</span>
                </div>
              ) : (
                <div
                  className={cn(
                    isAdminCal ? 'flex h-full min-h-0 flex-col' : 'grid grid-cols-7 gap-1',
                  )}
                >
                  <div
                    className={cn(
                      'grid grid-cols-7 gap-0.5',
                      isAdminCal ? 'admin-cal-weekdays shrink-0' : 'contents',
                    )}
                  >
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div
                        key={day}
                        className={cn(
                          'text-center font-semibold uppercase tracking-wider',
                          isAdminCal ? 'admin-cal-weekday' : 'py-1 text-xs text-muted',
                        )}
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  <div
                    className={cn(
                      'grid grid-cols-7 gap-0.5',
                      isAdminCal ? 'admin-cal-day-grid min-h-0 flex-1' : 'contents',
                    )}
                  >
                  {Array.from({ length: leadingEmptyCells }).map((_, index) => (
                    <div
                      key={`pad-${index}`}
                      className={cn(
                        'rounded-lg border border-transparent bg-transparent',
                        isAdminCal ? 'admin-cal-day-pad' : 'min-h-[5rem] xl:min-h-[5.5rem]',
                      )}
                      aria-hidden
                    />
                  ))}
                  {monthDays.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const dayHolidays = getHolidaysForDay(dateStr)
                    const dayLeaves = getLeavesForDay(dateStr)
                    const dayEvents = getEventsForDay(dateStr)
                    const isTodayDate = isToday(day)
                    const hasMultipleLeaves = dayLeaves.length > 1

                    return (
                      <Tooltip.Root key={dateStr}>
                        <Tooltip.Trigger asChild>
                          <div
                            onClick={() => handleDateClick(dateStr)}
                            className={cn(
                              'rounded-lg border transition-all cursor-pointer flex flex-col gap-0.5 hover:shadow-sm overflow-hidden',
                              isAdminCal
                                ? 'admin-cal-day border-[rgba(38,107,28,0.15)] bg-white/75 p-1 hover:border-[rgba(38,107,28,0.35)] hover:bg-emerald-50/80'
                                : 'min-h-[5rem] xl:min-h-[5.5rem] p-1.5 bg-white border-border hover:border-primary/50',
                              isTodayDate && (isAdminCal
                                ? 'admin-cal-day-today ring-2 ring-[rgba(38,107,28,0.25)] border-[var(--emerald-dark)]/40 bg-emerald-50/90'
                                : 'ring-2 ring-primary/20 border-primary/40 bg-primary/5'),
                              hasMultipleLeaves && (isAdminCal ? 'bg-red-50/50' : 'bg-red-50/40'),
                            )}
                          >
                            <div className="flex justify-between items-start">
                              <span className={cn(
                                'text-sm font-semibold',
                                isTodayDate
                                  ? isAdminCal ? 'text-[var(--emerald-dark)]' : 'text-primary'
                                  : 'text-ink',
                              )}>
                                {format(day, 'd')}
                              </span>
                              <div className="flex gap-0.5">
                                {dayHolidays.map((h, i) => (
                                  <div
                                    key={i}
                                    className={`h-2 w-2 rounded-full ${
                                      h.type === 'National'
                                        ? 'bg-green-500'
                                        : h.type === 'Company'
                                        ? 'bg-blue-500'
                                        : h.type === 'Company Event'
                                        ? 'bg-orange-500'
                                        : 'bg-green-500'
                                    }`}
                                  />
                                ))}
                                {dayEvents.map((_, i) => (
                                  <div key={`event-${i}`} className="h-2 w-2 rounded-full bg-amber-500" />
                                ))}
                              </div>
                            </div>
                            <div className="flex-1 overflow-hidden flex flex-col gap-1 mt-1">
                              {dayHolidays.slice(0, 2).map((h) => (
                                <div key={h.id} className={`text-[10px] font-semibold leading-tight truncate px-1.5 py-0.5 rounded border ${
                                  h.type === 'Company' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-green-50 text-green-700 border-green-100'
                                }`}>
                                  {h.title}
                                </div>
                              ))}
                              {dayEvents.slice(0, 1).map((e) => (
                                <div key={e.id} className="text-[10px] font-medium leading-tight truncate px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                                  {e.title}
                                </div>
                              ))}
                              {dayLeaves.slice(0, 1).map((l) => (
                                <div key={l.id} className="text-[10px] leading-tight truncate px-1.5 py-0.5 rounded bg-lime-100 text-lime-800 border border-lime-200/50">
                                  {l.employeeName.split(' ').map((n) => n[0]).join('')} - {l.type.split(' ')[0]}
                                </div>
                              ))}
                              {dayLeaves.length > 1 && (
                                <div className="text-[10px] font-semibold text-muted pl-1">
                                  +{dayLeaves.length - 1} more
                                </div>
                              )}
                            </div>
                          </div>
                        </Tooltip.Trigger>
                        {(dayHolidays.length > 0 || dayLeaves.length > 0 || dayEvents.length > 0) && (
                          <Tooltip.Portal>
                            <Tooltip.Content
                              className="z-[100] max-w-sm rounded-xl bg-white p-3 text-sm shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95"
                              sideOffset={5}
                            >
                              <div className="space-y-3">
                                <p className="font-semibold text-ink border-b border-border pb-1.5">
                                  {format(day, 'EEEE, MMMM d, yyyy')}
                                </p>
                                {dayHolidays.length > 0 && (
                                  <div>
                                    <p className="text-[11px] uppercase tracking-wider text-muted font-bold mb-1.5">Holidays</p>
                                    <div className="space-y-1">
                                      {dayHolidays.map((h) => (
                                        <div key={h.id} className="flex items-center gap-2">
                                          <div className={`h-1.5 w-1.5 rounded-full ${
                                            h.type === 'National'
                                              ? 'bg-green-500'
                                              : h.type === 'Company'
                                              ? 'bg-blue-500'
                                              : h.type === 'Company Event'
                                              ? 'bg-orange-500'
                                              : 'bg-green-500'
                                          }`} />
                                          <span className="text-ink text-xs font-medium">{h.title}</span>
                                          <span className="text-muted text-[10px]">(
                                            {h.type === 'Company'
                                              ? 'Company Holiday'
                                              : h.type === 'Company Event'
                                              ? 'Company Event'
                                              : 'Public Holiday'}
                                          )</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {dayEvents.length > 0 && (
                                  <div>
                                    <p className="text-[11px] uppercase tracking-wider text-muted font-bold mb-1.5">Events</p>
                                    <div className="space-y-1">
                                      {dayEvents.map((e) => (
                                        <div key={e.id} className="flex items-center gap-2">
                                          <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                          <span className="text-ink text-xs font-medium">{e.title}</span>
                                          {e.time && <span className="text-muted text-[10px]">{e.time}</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {dayLeaves.length > 0 && (
                                  <div>
                                    <p className="text-[11px] uppercase tracking-wider text-muted font-bold mb-1.5">Approved Leaves</p>
                                    <div className="space-y-1">
                                      {dayLeaves.map((l) => (
                                        <div key={l.id} className="flex items-center gap-2">
                                          <div className="h-1.5 w-1.5 rounded-full bg-lime-500" />
                                          <span className="text-ink text-xs font-medium">{l.employeeName}</span>
                                          <span className="text-muted text-[10px]">({l.type})</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <Tooltip.Arrow className="fill-white" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        )}
                      </Tooltip.Root>
                    )
                  })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right Column: Stacked Cards Column ───────────────────── */}
        <div
          className={cn(
            'flex flex-col gap-3',
            !isAdminCal && 'lg:col-span-1',
            isAdminCal && 'admin-cal-sidebar h-full min-h-0 gap-1.5',
          )}
        >

          {/* Month Holidays */}
          <div
            className={cn(
              'flex flex-col rounded-xl shadow-sm',
              isAdminCal ? 'admin-cal-side-card min-h-0 flex-1 p-2' : 'h-[220px] border border-border bg-white p-3',
            )}
          >
            <div className={cn('mb-2 flex items-center justify-between flex-shrink-0', isAdminCal && 'admin-cal-side-head')}>
              <div className="flex items-center gap-2">
                <h3 className={cn(
                  'font-display text-sm font-semibold',
                  isAdminCal ? 'text-[var(--emerald-dark)]' : 'text-ink',
                )}>
                  {format(currentDate, 'MMM yyyy')} Holidays
                </h3>
                <span className={cn(
                  'inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold',
                  isAdminCal ? 'admin-cal-count-badge' : 'bg-blue-100 text-blue-700',
                )}>
                  {sidebarHolidays.length}
                </span>
              </div>
            </div>

            {/* Legend inside Holidays card */}
            <div
              className={cn(
                'mb-1.5 flex flex-shrink-0 gap-2 border-b border-border pb-1 text-[10px] font-medium',
                isAdminCal && 'admin-cal-side-legend',
              )}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-muted">Public Holiday</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-muted">Company Holiday</span>
              </div>
            </div>

            {sidebarHolidays.length > 0 ? (
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
                {sidebarHolidays
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((holiday) => {
                    const dayName = format(new Date(holiday.date), 'EEE')
                    return (
                      <div
                        key={holiday.id}
                        className={cn(
                          'group flex items-center justify-between p-2 rounded-lg border transition-all',
                          isAdminCal
                            ? 'admin-cal-list-item border-[rgba(38,107,28,0.12)] hover:border-[rgba(38,107,28,0.28)]'
                            : 'border-border hover:border-primary/40 hover:shadow-sm',
                        )}
                      >
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white flex-shrink-0 shadow-sm ${
                            holiday.type === 'National'
                              ? 'bg-green-500'
                              : holiday.type === 'Company'
                              ? 'bg-blue-500'
                              : holiday.type === 'Company Event'
                              ? 'bg-orange-500'
                              : 'bg-green-500'
                          }`}>
                            🎉
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-ink text-xs truncate">{holiday.title}</h4>
                            <p className="text-[10px] text-muted">
                              {dayName} • {formatDate(holiday.date)}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="secondary" className="h-6 w-6 p-0" onClick={() => handleEditHoliday(holiday)}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="danger" className="h-6 w-6 p-0" onClick={() => { setHolidayToDelete(holiday); setDeleteConfirmOpen(true) }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            ) : (
              <div
                className={cn(
                  'flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed text-center',
                  isAdminCal ? 'admin-cal-empty py-2' : 'border-border bg-surface/50 p-4',
                )}
              >
                <span className={cn('opacity-50', isAdminCal ? 'text-base' : 'mb-1 text-xl')}>📅</span>
                <p className="text-muted text-[10px] font-medium">No holidays this month</p>
              </div>
            )}
          </div>

          {/* Company Events */}
          <div
            className={cn(
              'flex flex-col rounded-xl shadow-sm',
              isAdminCal ? 'admin-cal-side-card min-h-0 flex-1 p-2' : 'h-[220px] border border-border bg-white p-3',
            )}
          >
            <div className={cn('mb-2 flex items-center justify-between flex-shrink-0', isAdminCal && 'admin-cal-side-head')}>
              <div className="flex items-center gap-2">
                <h3 className={cn(
                  'font-display text-sm font-semibold',
                  isAdminCal ? 'text-[var(--emerald-dark)]' : 'text-ink',
                )}>
                  Company Events
                </h3>
                <span className={cn(
                  'inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold',
                  isAdminCal ? 'admin-cal-count-badge admin-cal-count-badge-amber' : 'bg-amber-100 text-amber-700',
                )}>
                  {sidebarEvents.length}
                </span>
              </div>
            </div>

            {sidebarEvents.length > 0 ? (
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
                {sidebarEvents
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        'group flex items-center p-2 rounded-lg border transition-all',
                        isAdminCal
                          ? 'admin-cal-list-item border-[rgba(38,107,28,0.12)] hover:border-[rgba(38,107,28,0.28)]'
                          : 'border-border hover:border-primary/40 hover:shadow-sm',
                      )}
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-amber-100 to-amber-50 flex-shrink-0 text-sm shadow-sm font-semibold text-amber-700">
                        📢
                      </div>
                      <div className="flex-1 ml-2 min-w-0">
                        <h4 className="font-semibold text-ink text-xs truncate">{event.title}</h4>
                        <p className="text-[10px] text-muted">{event.time || 'All day'} • {formatDate(event.date)}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="danger"
                        className="h-6 w-6 p-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={() => { setEventToDelete(event); setEventDeleteConfirmOpen(true) }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
              </div>
            ) : (
              <div
                className={cn(
                  'flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed text-center',
                  isAdminCal ? 'admin-cal-empty py-2' : 'border-border bg-surface/50 p-4',
                )}
              >
                <span className={cn('opacity-50', isAdminCal ? 'text-base' : 'mb-1 text-xl')}>📢</span>
                <p className="text-muted text-[10px] font-medium">No events this month</p>
              </div>
            )}
          </div>

          {/* Approved Leaves */}
          <div
            className={cn(
              'flex flex-col rounded-xl shadow-sm',
              isAdminCal ? 'admin-cal-side-card min-h-0 flex-1 p-2' : 'h-[220px] border border-border bg-white p-3',
            )}
          >
            <div className={cn('mb-2 flex items-center justify-between flex-shrink-0', isAdminCal && 'admin-cal-side-head')}>
              <div className="flex items-center gap-2">
                <h3 className={cn(
                  'font-display text-sm font-semibold',
                  isAdminCal ? 'text-[var(--emerald-dark)]' : 'text-ink',
                )}>Approved Leaves</h3>
                <span className={cn(
                  'inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold',
                  isAdminCal ? 'admin-cal-count-badge admin-cal-count-badge-lime' : 'bg-lime-100 text-lime-700',
                )}>
                  {sidebarLeaves.length}
                </span>
              </div>
            </div>
            {sidebarLeaves.length > 0 ? (
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
                {sidebarLeaves.map((leave) => (
                  <div
                    key={leave.id}
                    className={cn(
                      'flex items-center p-2 rounded-lg border transition-all',
                      isAdminCal
                        ? 'admin-cal-list-item border-[rgba(38,107,28,0.12)] hover:border-[rgba(38,107,28,0.28)]'
                        : 'border-border hover:border-primary/40 hover:shadow-sm',
                    )}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-lime-100 to-lime-50 flex-shrink-0 text-sm shadow-sm">
                      ✈️
                    </div>
                    <div className="flex-1 ml-2 min-w-0">
                      <h4 className="font-semibold text-ink text-xs truncate">{leave.employeeName}</h4>
                      <p className="text-[10px] text-muted">{leave.type} • {leave.days}d</p>
                    </div>
                    <div className="text-right ml-2 flex-shrink-0">
                      <span className="text-xs font-medium text-ink block">{format(new Date(leave.from), 'MMM d')}</span>
                      {leave.days > 1 && <span className="text-[10px] text-muted block leading-none">to {format(new Date(leave.to), 'MMM d')}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className={cn(
                  'flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed text-center',
                  isAdminCal ? 'admin-cal-empty py-2' : 'border-border bg-surface/50 p-4',
                )}
              >
                <span className={cn('opacity-50', isAdminCal ? 'text-base' : 'mb-1 text-xl')}>🏖️</span>
                <p className="text-muted text-[10px] font-medium">No approved leaves this month</p>
              </div>
            )}
          </div>

        </div>
      </div>
      </div>

      {/* Date Click Modal - Shows what's on that date */}
      {isDateModalOpen && selectedDateStr && (
        <Modal isOpen={isDateModalOpen} onClose={() => setIsDateModalOpen(false)} title="Day Details">
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted mb-1 uppercase tracking-wider font-semibold">Date</p>
              <p className="text-sm font-semibold text-ink">
                {format(new Date(selectedDateStr), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>

            {itemsOnSelectedDate.holidays.length > 0 && (
              <div>
                <h4 className="font-semibold text-ink text-sm mb-2 flex items-center gap-1.5">
                  🎉 Holidays
                </h4>
                <div className="space-y-2">
                  {itemsOnSelectedDate.holidays.map((h) => (
                    <div key={h.id} className={`text-sm p-3 rounded-lg flex justify-between items-center border ${
                      h.type === 'National'
                        ? 'bg-green-55 border-green-100'
                        : h.type === 'Company'
                        ? 'bg-blue-55 border-blue-100'
                        : h.type === 'Company Event'
                        ? 'bg-orange-55 border-orange-100'
                        : 'bg-green-55 border-green-100'
                    }`}>
                      <span className={`font-semibold ${
                        h.type === 'Company'
                          ? 'text-blue-900'
                          : h.type === 'Company Event'
                          ? 'text-orange-900'
                          : 'text-green-900'
                      }`}>{h.title}</span>
                      <Badge variant={
                        h.type === 'National'
                          ? 'success'
                          : h.type === 'Company'
                          ? 'info'
                          : h.type === 'Company Event'
                          ? 'warning'
                          : 'success'
                      }>
                        {h.type === 'Company'
                          ? 'Company Holiday'
                          : h.type === 'Company Event'
                          ? 'Company Event'
                          : 'Public Holiday'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {itemsOnSelectedDate.events && itemsOnSelectedDate.events.length > 0 && (
              <div>
                <h4 className="font-semibold text-ink text-sm mb-2 flex items-center gap-1.5">
                  📢 Events
                </h4>
                <div className="space-y-2">
                  {itemsOnSelectedDate.events.map((e) => (
                    <div key={e.id} className="text-sm p-3 rounded-lg bg-amber-50 border border-amber-100">
                      <span className="font-medium text-amber-900">{e.title}</span>
                      {e.time && <span className="text-amber-700 text-xs block mt-1">{e.time}</span>}
                      {e.description && <span className="text-amber-700 text-xs block mt-1">{e.description}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {itemsOnSelectedDate.leaves.length > 0 && (
              <div>
                <h4 className="font-semibold text-ink text-sm mb-2 flex items-center gap-1.5">
                  ✈️ Employees on Leave
                </h4>
                <div className="space-y-2">
                  {itemsOnSelectedDate.leaves.map((l) => (
                    <div key={l.id} className="text-sm p-3 rounded-lg bg-green-50 border border-green-100 flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-green-900">{l.employeeName}</p>
                        <p className="text-xs text-green-700 mt-0.5">{l.type} • {l.days} days</p>
                      </div>
                      <Badge variant="success">Approved</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {itemsOnSelectedDate.leaves.length === 0 && itemsOnSelectedDate.holidays.length === 0 && (!itemsOnSelectedDate.events || itemsOnSelectedDate.events.length === 0) && (
              <div className="py-8 text-center text-muted">
                <span className="text-3xl block mb-2">📅</span>
                <p className="text-sm">No events on this date</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Holiday Form Modal */}
      {isHolidayFormOpen && (
        <Modal isOpen={isHolidayFormOpen} onClose={() => {
          setIsHolidayFormOpen(false)
          resetHolidayForm()
        }} title={editingId ? 'Edit Holiday' : 'Add Holiday'}>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Holiday Name <span className="text-red-500">*</span></label>
              <Input
                placeholder="e.g., Independence Day"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Date <span className="text-red-500">*</span></label>
              <DateInput
                value={date}
                onChange={setDate}
                minDate={calendarBounds.min}
                maxDate={calendarBounds.max}
                placeholder="dd/mm/yyyy"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'National' | 'Company' | 'Optional' | 'Company Event')}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
              >
                <option value="National">Public Holiday</option>
                <option value="Company">Company Holiday</option>
                <option value="Company Event">Company Event</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Description (Optional)</label>
              <textarea
                placeholder="Details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition-shadow"
                rows={3}
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsHolidayFormOpen(false)
                  resetHolidayForm()
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddHoliday}>
                {editingId ? 'Update Holiday' : 'Save Holiday'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Holiday Confirmation */}
      {deleteConfirmOpen && holidayToDelete && (
        <ConfirmModal
          isOpen={deleteConfirmOpen}
          onConfirm={handleDeleteHoliday}
          onClose={() => {
            setDeleteConfirmOpen(false)
            setHolidayToDelete(null)
          }}
          title="Delete Holiday"
          description={`Are you sure you want to delete "${holidayToDelete.title}"? This action cannot be undone.`}
          confirmLabel="Delete"
          danger
        />
      )}

      {/* Delete Event Confirmation */}
      {eventDeleteConfirmOpen && eventToDelete && (
        <ConfirmModal
          isOpen={eventDeleteConfirmOpen}
          onConfirm={handleDeleteEvent}
          onClose={() => {
            setEventDeleteConfirmOpen(false)
            setEventToDelete(null)
          }}
          title="Delete Event"
          description={`Remove "${eventToDelete.title}" from the calendar?`}
          confirmLabel="Delete"
          danger
        />
      )}
    </Tooltip.Provider>
  )
}
