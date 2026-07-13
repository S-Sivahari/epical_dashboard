import { useState, useMemo, useEffect, useRef } from 'react'
import { useLeaves } from '@hooks/useLeaves'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  parseISO,
} from 'date-fns'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Badge } from '@components/ui/Badge'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { DateInput } from '@components/shared/DateInput'
import { getCalendarEntryBounds, validateIsoInRange } from '@/utils/dateValidation'
import { Plus, Edit2, Trash2, ChevronLeft, ChevronRight, Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { formatDate } from '@/utils/formatDate'
import type { Holiday } from '@/types'
import { isLeaveEnded, sortApprovedLeavesUpcomingFirst } from '@utils/leaveFilters'
import { cn } from '@/utils/cn'
import * as leaveService from '@services/leaveService'
import type { TeamLeaveEntry } from '@services/leaveService'
import type { LeaveRequest } from '@/types'
import { useLeaveStore } from '@store/leaveStore'

interface CalendarSidebarEvent {
  id: string
  title: string
  date: string
  time?: string
  holidayType?: Holiday['type']
}

interface CompanyCalendarProps {
  variant?: 'default' | 'admin' | 'employee'
}

function dateInViewMonth(dateStr: string, monthIdx: number, year: number): boolean {
  const d = parseISO(dateStr)
  return d.getMonth() === monthIdx && d.getFullYear() === year
}

function isEventFormMode(
  editingKind: 'holiday' | 'calendarEvent' | null,
  itemType: Holiday['type'],
): boolean {
  return editingKind === 'calendarEvent' || itemType === 'Company Event'
}

function formatLeaveDayCellLabel(leave: LeaveRequest, showEmployeeName: boolean): string {
  const typeShort = leave.type.split(' ')[0] || leave.type
  if (!showEmployeeName) return typeShort
  const initials = leave.employeeName
    .split(' ')
    .map((n) => n[0])
    .join('')
  return `${initials} - ${typeShort}`
}

function formatLeavePrimaryLabel(leave: LeaveRequest, showEmployeeName: boolean): string {
  return showEmployeeName ? leave.employeeName : leave.type
}

const CAL_SIDEBAR_ACTION_BTN = 'h-7 w-7 shrink-0 p-0 shadow-sm'
const CAL_SIDEBAR_EDIT_BTN = cn(
  CAL_SIDEBAR_ACTION_BTN,
  'border border-[rgba(38,107,28,0.28)] bg-white text-[#266b1c] hover:bg-[#e8f2e6]',
)
const CAL_SIDEBAR_DELETE_BTN = cn(
  CAL_SIDEBAR_ACTION_BTN,
  'admin-cal-delete-btn border border-red-600 bg-red-600 text-white hover:bg-red-700 hover:border-red-700',
)

function expandHolidayDateRange(from: string, to: string): string[] {
  if (!from) return []
  if (!to || to === from) return [from]
  const start = parseISO(from)
  const end = parseISO(to)
  if (end < start) return []
  return eachDayOfInterval({ start, end }).map((day) => format(day, 'yyyy-MM-dd'))
}

export function CompanyCalendar({ variant = 'default' }: CompanyCalendarProps) {
  const isEmployeeCal = variant === 'employee'
  const isAdminCal = variant === 'admin'
  const useAdminLayout = variant === 'admin' || isEmployeeCal
  const canManage = isAdminCal
  const showLeaveEmployeeNames = isEmployeeCal
  const showLeaveEmployeeNamesOnHover = isEmployeeCal || isAdminCal
  const { holidays, leaves, loading, companyCalendarEvents } = useLeaves()
  const [teamLeaves, setTeamLeaves] = useState<TeamLeaveEntry[]>([])
  const [ownApprovedLeaves, setOwnApprovedLeaves] = useState<LeaveRequest[]>([])

  useEffect(() => {
    if (!isEmployeeCal) return
    leaveService.getTeamLeaves().then(setTeamLeaves).catch(() => {})
    leaveService
      .getLeaveHistory()
      .then((history) =>
        setOwnApprovedLeaves(history.filter((l) => l.status === 'Approved')),
      )
      .catch(() => {})
  }, [isEmployeeCal])
  const updateHoliday = useLeaveStore((s) => s.updateHoliday)
  const deleteHoliday = useLeaveStore((s) => s.deleteHoliday)
  const fetchHolidays = useLeaveStore((s) => s.fetchHolidays)
  const addCompanyCalendarEvent = useLeaveStore((s) => s.addCompanyCalendarEvent)
  const updateCompanyCalendarEvent = useLeaveStore((s) => s.updateCompanyCalendarEvent)
  const deleteCompanyCalendarEvent = useLeaveStore((s) => s.deleteCompanyCalendarEvent)
  const deleteLeave = useLeaveStore((s) => s.deleteLeave)

  const [currentDate, setCurrentDate] = useState(new Date())
  const [eventDeleteConfirmOpen, setEventDeleteConfirmOpen] = useState(false)
  const [eventToDelete, setEventToDelete] = useState<CalendarSidebarEvent | null>(null)
  const [leaveDeleteConfirmOpen, setLeaveDeleteConfirmOpen] = useState(false)
  const [leaveToDelete, setLeaveToDelete] = useState<LeaveRequest | null>(null)
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null)
  const [isDateModalOpen, setIsDateModalOpen] = useState(false)
  const [isHolidayFormOpen, setIsHolidayFormOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingKind, setEditingKind] = useState<'holiday' | 'calendarEvent' | null>(null)
  const [holidayToDelete, setHolidayToDelete] = useState<Holiday | null>(null)
  const holidayImportInputRef = useRef<HTMLInputElement>(null)
  const [downloadingHolidayTemplate, setDownloadingHolidayTemplate] = useState(false)
  const [uploadingHolidayImport, setUploadingHolidayImport] = useState(false)

  const dbSidebarEvents = useMemo(
    (): CalendarSidebarEvent[] =>
      companyCalendarEvents.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        time: e.time,
      })),
    [companyCalendarEvents],
  )

  // Holiday form state
  const [title, setTitle] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [time, setTime] = useState('')
  const [type, setType] = useState<'National' | 'Company' | 'Optional' | 'Company Event'>('National')

  // Calendar logic
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const goToToday = () => setCurrentDate(startOfMonth(new Date()))

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const leadingEmptyCells = monthStart.getDay()

  const currentMonthIdx = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  const approvedLeaves = useMemo(() => {
    if (!isEmployeeCal) return leaves.filter((l) => l.status === 'Approved')
    const ownIds = new Set(ownApprovedLeaves.map((l) => l.id))
    const fromTeam: LeaveRequest[] = teamLeaves
      .filter((t) => !ownIds.has(t.id))
      .map((t) => ({
        id: t.id,
        employeeId: '',
        employeeName: t.employeeName,
        type: t.type,
        leaveDuration: 'Full Day',
        from: t.from,
        to: t.to,
        days: t.days,
        reason: '',
        status: 'Approved',
      }))
    return [...ownApprovedLeaves, ...fromTeam]
  }, [leaves, teamLeaves, ownApprovedLeaves, isEmployeeCal])

  const holidayEvents = useMemo((): CalendarSidebarEvent[] => {
    return holidays
      .filter((h) => h.type === 'Company Event')
      .map((h) => ({
        id: h.id,
        title: h.title,
        date: h.date,
        holidayType: h.type,
      }))
  }, [holidays])

  const getHolidaysForDay = (dateStr: string) =>
    holidays.filter((h) => h.date === dateStr && h.type !== 'Company Event')
  const getLeavesForDay = (dateStr: string) =>
    approvedLeaves.filter((l) => dateStr >= l.from && dateStr <= l.to)
  const getEventsForDay = (dateStr: string) => {
    const fromDb = dbSidebarEvents.filter((e) => e.date === dateStr)
    const fromLegacy = holidayEvents.filter((e) => e.date === dateStr)
    const seen = new Set(fromDb.map((e) => e.id))
    return [...fromDb, ...fromLegacy.filter((e) => !seen.has(e.id))]
  }

  const itemsOnSelectedDate = useMemo(() => {
    if (!selectedDateStr) return { leaves: [], holidays: [], events: [] }
    const fromDb = dbSidebarEvents.filter((e) => e.date === selectedDateStr)
    const fromLegacy = holidayEvents.filter((e) => e.date === selectedDateStr)
    const seen = new Set(fromDb.map((e) => e.id))
    const events = [...fromDb, ...fromLegacy.filter((e) => !seen.has(e.id))]
    return {
      leaves: approvedLeaves.filter((l) => selectedDateStr >= l.from && selectedDateStr <= l.to),
      holidays: holidays.filter(
        (h) => h.date === selectedDateStr && h.type !== 'Company Event',
      ),
      events,
    }
  }, [selectedDateStr, approvedLeaves, holidays, dbSidebarEvents, holidayEvents])

  const handleDateClick = (dateStr: string) => {
    setSelectedDateStr(dateStr)
    setIsDateModalOpen(true)
  }

  const resetHolidayForm = () => {
    setTitle('')
    setFromDate('')
    setToDate('')
    setTime('')
    setType('National')
    setEditingId(null)
    setEditingKind(null)
  }

  const openAddHolidayForm = () => {
    resetHolidayForm()
    setType('National')
    setIsHolidayFormOpen(true)
  }

  const openAddEventForm = () => {
    resetHolidayForm()
    setType('Company Event')
    setIsHolidayFormOpen(true)
  }

  const isEventForm = isEventFormMode(editingKind, type)
  const formNameLabel = isEventForm ? 'Event Name' : 'Holiday Name'
  const formTitle = editingId
    ? isEventForm
      ? 'Edit Event'
      : 'Edit Holiday'
    : isEventForm
      ? 'Add Event'
      : 'Add Holiday'
  const formSaveLabel = editingId
    ? isEventForm
      ? 'Update Event'
      : 'Update Holiday'
    : isEventForm
      ? 'Save Event'
      : 'Save Holiday'

  const calendarBounds = getCalendarEntryBounds()

  const handleDownloadHolidayTemplate = async () => {
    try {
      setDownloadingHolidayTemplate(true)
      await leaveService.downloadHolidayImportTemplate()
      toast.success('Holiday import template downloaded')
    } catch {
      toast.error('Failed to download holiday template')
    } finally {
      setDownloadingHolidayTemplate(false)
    }
  }

  const handleHolidayImportFileChange = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return

    try {
      setUploadingHolidayImport(true)
      const result = await leaveService.importHolidaysFromExcel(file)
      await fetchHolidays()

      if (result.created.length > 0) {
        const firstCreated = result.created[0]
        if (firstCreated?.date) {
          setCurrentDate(startOfMonth(parseISO(firstCreated.date)))
        }
        toast.success(
          `Imported ${result.created.length} holiday${result.created.length === 1 ? '' : 's'} successfully`,
        )
        setIsHolidayFormOpen(false)
        resetHolidayForm()
      } else {
        toast.error('No new holidays were added')
      }

      if (result.skipped.length > 0) {
        toast.message(`${result.skipped.length} date(s) skipped (already on calendar)`)
      }
      if (result.rowErrors.length > 0) {
        const first = result.rowErrors[0]
        toast.error(`Row ${first.rowNumber}: ${first.errors.join(', ')}`)
      }
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err instanceof Error ? err.message : 'Failed to import holidays')
      toast.error(message)
    } finally {
      setUploadingHolidayImport(false)
      if (holidayImportInputRef.current) holidayImportInputRef.current.value = ''
    }
  }

  const handleAddHoliday = async () => {
    const usesDateRange = !editingId && !isEventForm

    if (!title.trim() || !fromDate || (usesDateRange && toDate && toDate < fromDate)) {
      if (usesDateRange && fromDate && toDate && toDate < fromDate) {
        toast.error('To Date cannot be earlier than From Date')
        return
      }
      toast.error(
        `Please fill ${isEventForm ? 'event' : 'holiday'} name and ${usesDateRange ? 'from date' : 'date'}`,
      )
      return
    }

    const datesToSave = usesDateRange
      ? expandHolidayDateRange(fromDate, toDate.trim())
      : [fromDate]

    for (const isoDate of datesToSave) {
      const dateCheck = validateIsoInRange(isoDate, calendarBounds.min, calendarBounds.max)
      if (!dateCheck.valid) {
        toast.error(dateCheck.error)
        return
      }
    }

    try {
      if (editingId) {
        if (editingKind === 'calendarEvent') {
          await updateCompanyCalendarEvent(editingId, {
            title,
            date: fromDate,
            time: time.trim() || undefined,
          })
        } else {
          await updateHoliday(editingId, { title, date: fromDate, type })
        }
      } else if (type === 'Company Event') {
        await addCompanyCalendarEvent({
          title,
          date: fromDate,
          time: time.trim() || undefined,
        })
      } else {
        const existingDates = new Set(holidays.map((h) => h.date))
        const datesToCreate = datesToSave.filter((isoDate) => !existingDates.has(isoDate))
        const skipped = datesToSave.length - datesToCreate.length

        if (datesToCreate.length === 0) {
          toast.error(
            skipped > 0
              ? 'No new holidays added — selected date(s) already exist on the calendar'
              : 'No holidays were added',
          )
          return
        }

        const result = await leaveService.addHolidaysBulk({
          title,
          type,
          dates: datesToCreate,
        })
        const created = result.created.length

        if (created === 0) {
          toast.error(
            skipped > 0 || result.skippedDates.length > 0
              ? 'No new holidays added — selected date(s) already exist on the calendar'
              : 'No holidays were added',
          )
          return
        }

        const totalSkipped = skipped + result.skippedDates.length
        if (totalSkipped > 0) {
          toast.message(`${totalSkipped} date(s) skipped (already on calendar)`)
        }
      }

      await fetchHolidays()
      setCurrentDate(startOfMonth(parseISO(fromDate)))
      resetHolidayForm()
      setIsHolidayFormOpen(false)
      toast.success(editingId ? 'Updated successfully' : 'Saved successfully')
    } catch {
      toast.error('Failed to save')
    }
  }

  const handleEditHoliday = (holiday: Holiday) => {
    setTitle(holiday.title)
    setFromDate(holiday.date)
    setToDate('')
    setType(holiday.type)
    setTime('')
    setEditingId(holiday.id)
    setEditingKind('holiday')
    setIsHolidayFormOpen(true)
  }

  const handleEditEvent = (event: CalendarSidebarEvent) => {
    setTitle(event.title)
    setFromDate(event.date)
    setToDate('')
    setTime(event.time || '')
    setType('Company Event')
    setEditingId(event.id)
    setEditingKind(event.holidayType ? 'holiday' : 'calendarEvent')
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

  const sidebarHolidays = useMemo(() => {
    return holidays.filter(
      (h) => h.type !== 'Company Event' && dateInViewMonth(h.date, currentMonthIdx, currentYear),
    )
  }, [holidays, currentMonthIdx, currentYear])

  const sidebarEvents = useMemo(() => {
    return [...dbSidebarEvents, ...holidayEvents].filter((e) =>
      dateInViewMonth(e.date, currentMonthIdx, currentYear),
    )
  }, [dbSidebarEvents, holidayEvents, currentMonthIdx, currentYear])

  const sidebarLeaves = useMemo(() => {
    const filtered = approvedLeaves.filter((leave) => {
      const fromDate = parseISO(leave.from)
      const toDate = parseISO(leave.to)
      return (
        dateInViewMonth(leave.from, currentMonthIdx, currentYear) ||
        dateInViewMonth(leave.to, currentMonthIdx, currentYear) ||
        (fromDate < monthStart && toDate > monthEnd)
      )
    })
    return sortApprovedLeavesUpcomingFirst(filtered)
  }, [approvedLeaves, currentMonthIdx, currentYear, monthStart, monthEnd])

  const handleDeletePastLeave = async () => {
    if (!leaveToDelete) return
    try {
      await deleteLeave(leaveToDelete.id)
      setLeaveDeleteConfirmOpen(false)
      setLeaveToDelete(null)
      toast.success('Past leave removed')
    } catch {
      toast.error('Failed to remove past leave')
    }
  }

  return (
    <Tooltip.Provider delayDuration={300}>
      <div
        className={cn(useAdminLayout && 'flex min-h-0 flex-1 flex-col')}
      >
      <div
        className={cn(
          'grid w-full pl-0 pr-0',
          useAdminLayout
            ? 'admin-calendar-grid min-h-0 flex-1 gap-3 pb-0'
            : 'grid-cols-1 gap-4 pb-4 lg:grid-cols-3 xl:grid-cols-4',
        )}
      >

        {/* ── Left Column: Calendar Card ────────────────────────────── */}
        <div
          className={cn(
            'flex w-full min-w-0 flex-col',
            !useAdminLayout && 'lg:col-span-2 xl:col-span-3',
            useAdminLayout && 'admin-cal-main-col min-h-0',
          )}
        >
          <div
            className={cn(
              'flex w-full flex-col overflow-hidden',
              useAdminLayout
                ? 'admin-cal-main min-h-0'
                : 'rounded-xl border border-border bg-white shadow-sm',
            )}
          >
            {/* Calendar Header */}
            <div className={cn(
              'p-3 flex items-center justify-between flex-shrink-0',
              useAdminLayout ? 'admin-cal-header' : 'border-b border-border bg-surface/30',
            )}>
              <div className="flex items-center gap-2">
                <div className={cn(
                  'flex items-center gap-1 rounded-lg border p-0.5',
                  useAdminLayout ? 'admin-cal-month-nav' : 'border-border bg-white',
                )}>
                  {useAdminLayout ? (
                    <>
                      <button
                        type="button"
                        className="admin-cal-nav-btn"
                        onClick={prevMonth}
                        aria-label="Previous month"
                      >
                        <ChevronLeft className="admin-cal-nav-icon h-4 w-4" aria-hidden />
                      </button>
                      <span className="admin-cal-month-title min-w-[7.5rem] px-2 text-center text-sm font-semibold">
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
                {useAdminLayout ? (
                  <button
                    type="button"
                    className="admin-cal-today-btn inline-flex h-7 items-center rounded-lg px-2.5 text-[11px] font-semibold transition-colors"
                    onClick={goToToday}
                  >
                    Today
                  </button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 px-3 text-xs"
                    onClick={goToToday}
                  >
                    Today
                  </Button>
                )}
              </div>
              {canManage ? (
                <Button
                  size="sm"
                  className={cn(
                    'h-8 px-3 text-xs shadow-sm',
                    useAdminLayout && 'admin-dash-action-btn border-0 !text-white [&_svg]:!text-white',
                  )}
                  onClick={openAddHolidayForm}
                >
                  <Plus className="h-4 w-4 mr-1.5 shrink-0" /> Add Holiday
                </Button>
              ) : null}
            </div>

            {/* Legend */}
            <div className={cn(
              'px-3 py-1.5 flex flex-wrap gap-3 text-xs font-medium flex-shrink-0',
              useAdminLayout ? 'admin-cal-legend' : 'border-b border-border bg-gray-50',
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
            <div className={cn('flex-1 min-h-0', useAdminLayout ? 'admin-cal-grid-wrap p-1.5' : 'p-2.5')}>
              {loading ? (
                <div className="flex h-48 items-center justify-center">
                  <span className={cn('text-sm', useAdminLayout ? 'admin-cal-loading-text' : 'text-muted')}>
                    Loading calendar...
                  </span>
                </div>
              ) : (
                <div
                  className={cn(
                    useAdminLayout ? 'flex min-h-0 flex-1 flex-col' : 'grid grid-cols-7 gap-1',
                  )}
                >
                  <div
                    className={cn(
                      'grid grid-cols-7 gap-0.5',
                      useAdminLayout ? 'admin-cal-weekdays shrink-0' : 'contents',
                    )}
                  >
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div
                        key={day}
                        className={cn(
                          'text-center font-semibold uppercase tracking-wider',
                          useAdminLayout ? 'admin-cal-weekday' : 'py-1 text-xs text-muted',
                        )}
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  <div
                    className={cn(
                      'grid grid-cols-7 gap-0.5',
                      useAdminLayout ? 'admin-cal-day-grid min-h-0 flex-1' : 'contents',
                    )}
                  >
                  {Array.from({ length: leadingEmptyCells }).map((_, index) => (
                    <div
                      key={`pad-${index}`}
                      className={cn(
                        'rounded-lg border border-transparent bg-transparent',
                        useAdminLayout ? 'admin-cal-day-pad' : 'min-h-[5rem] xl:min-h-[5.5rem]',
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
                              useAdminLayout
                                ? 'admin-cal-day border-[rgba(26,67,41,0.15)] bg-white/75 p-1 hover:border-[rgba(26,67,41,0.28)]'
                                : 'min-h-[5rem] xl:min-h-[5.5rem] p-1.5 bg-white border-border hover:border-primary/50',
                              isTodayDate && (useAdminLayout
                                ? 'admin-cal-day-today'
                                : 'ring-2 ring-primary/20 border-primary/40 bg-primary/5'),
                              hasMultipleLeaves && (useAdminLayout ? 'bg-red-50/50' : 'bg-red-50/40'),
                            )}
                          >
                            <div className="flex justify-between items-start">
                              <span className={cn(
                                'text-sm font-semibold',
                                isTodayDate
                                  ? useAdminLayout ? 'admin-cal-day-num-today' : 'text-primary'
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
                                  {formatLeaveDayCellLabel(l, showLeaveEmployeeNames)}
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
                                    <p className="text-[11px] uppercase tracking-wider text-muted font-bold mb-1.5">
                                      {showLeaveEmployeeNamesOnHover ? 'Employees on Leave' : 'Approved Leaves'}
                                    </p>
                                    <div className="space-y-1">
                                      {dayLeaves.map((l) => (
                                        <div key={l.id} className="flex items-center gap-2">
                                          <div className="h-1.5 w-1.5 rounded-full bg-lime-500" />
                                          <span className="text-ink text-xs font-medium">
                                            {formatLeavePrimaryLabel(l, showLeaveEmployeeNamesOnHover)}
                                          </span>
                                          {showLeaveEmployeeNamesOnHover ? (
                                            <span className="text-muted text-[10px]">
                                              ({l.type}{isAdminCal ? ` • ${l.days}d` : ''})
                                            </span>
                                          ) : (
                                            <span className="text-muted text-[10px]">• {l.days}d</span>
                                          )}
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
            'flex min-h-0 flex-col',
            !useAdminLayout && 'lg:col-span-1 gap-3',
            useAdminLayout && 'admin-cal-sidebar min-h-0',
          )}
        >
          <div
            className={cn(
              'flex h-full min-h-0 w-full max-w-full flex-col rounded-xl shadow-sm',
              useAdminLayout
                ? 'admin-cal-side-unified'
                : 'overflow-hidden border border-border bg-white',
            )}
          >
            <header
              className={cn(
                'flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2',
                useAdminLayout
                  ? 'admin-cal-side-unified-title'
                  : 'border-border',
              )}
            >
              <h2
                className={cn(
                  'font-display text-sm font-bold tracking-tight',
                  useAdminLayout ? 'admin-cal-side-month-label' : 'text-ink',
                )}
              >
                {format(currentDate, 'MMMM yyyy')}
              </h2>
              {canManage ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className={cn(
                    'h-7 shrink-0 px-2 text-[10px] font-semibold',
                    useAdminLayout && 'admin-cal-template-btn',
                  )}
                  disabled={downloadingHolidayTemplate}
                  onClick={() => void handleDownloadHolidayTemplate()}
                >
                  <Download className="mr-1 h-3 w-3 shrink-0" />
                  {downloadingHolidayTemplate ? 'Downloading…' : 'Download Template'}
                </Button>
              ) : null}
            </header>

            <div
              className={cn(
                'flex min-h-0 flex-1 flex-col gap-2',
                useAdminLayout ? 'admin-cal-side-unified-body overflow-x-hidden' : 'overflow-hidden p-3',
              )}
            >
              {/* Holidays */}
              <section
                className={cn(
                  'flex min-h-0 flex-1 flex-col rounded-lg',
                  useAdminLayout && 'admin-cal-side-section--scroll',
                  sidebarHolidays.length > 0 &&
                    (useAdminLayout
                      ? 'admin-cal-side-section--active admin-cal-side-section--active-holidays'
                      : 'border border-emerald-100/90 bg-emerald-50/50 px-2 py-1.5'),
                )}
              >
                <div className={cn('flex items-center gap-2', useAdminLayout && 'admin-cal-side-section-head')}>
                  <h3
                    className={cn(
                      'text-xs font-semibold',
                      useAdminLayout ? 'admin-cal-side-section-title' : 'text-ink',
                    )}
                  >
                    Holidays
                  </h3>
                  <span
                    className={cn(
                      'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                      useAdminLayout ? 'admin-cal-count-badge' : 'bg-blue-100 text-blue-700',
                    )}
                  >
                    {sidebarHolidays.length}
                  </span>
                  {canManage ? (
                    <button
                      type="button"
                      className="admin-cal-side-add-btn ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md border border-[rgba(38,107,28,0.2)] text-[#266b1c] hover:bg-[#e8f2e6]"
                      onClick={openAddHolidayForm}
                      aria-label="Add holiday"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>

                <div
                  className={cn(
                    'mb-1 flex flex-shrink-0 gap-2 text-[10px] font-medium',
                    useAdminLayout
                      ? 'admin-cal-side-legend flex-col items-start gap-1'
                      : 'border-b border-border pb-1 text-muted',
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-muted">Public Holiday</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-muted">Company Holiday</span>
                  </div>
                </div>

                {sidebarHolidays.length > 0 ? (
                  <div
                    className={cn(
                      'space-y-1 overflow-y-auto pr-1 custom-scrollbar',
                      useAdminLayout
                        ? 'admin-cal-side-section-list admin-cal-side-section-list--fills'
                        : 'admin-cal-side-section-list max-h-[6.75rem]',
                    )}
                  >
                    {[...sidebarHolidays]
                      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
                      .map((holiday) => {
                        const dayName = format(parseISO(holiday.date), 'EEE')
                        return (
                          <div
                            key={holiday.id}
                            className={cn(
                              'group flex items-center justify-between rounded-lg border transition-all',
                              useAdminLayout
                                ? 'admin-cal-list-item border-[rgba(38,107,28,0.12)] hover:border-[rgba(38,107,28,0.28)]'
                                : 'border-border p-2 hover:border-primary/40 hover:shadow-sm',
                            )}
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <div
                                className={cn(
                                  'flex flex-shrink-0 items-center justify-center rounded-md text-xs font-bold text-white shadow-sm',
                                  useAdminLayout ? 'admin-cal-list-icon h-7 w-7 text-xs' : 'h-7 w-7',
                                  holiday.type === 'National'
                                    ? 'bg-green-500'
                                    : holiday.type === 'Company'
                                      ? 'bg-blue-500'
                                      : 'bg-green-500',
                                )}
                              >
                                🎉
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4
                                  className={cn(
                                    'text-xs font-semibold text-ink',
                                    useAdminLayout ? 'line-clamp-2 leading-snug' : 'truncate',
                                  )}
                                >
                                  {holiday.title}
                                </h4>
                                <p className="text-[10px] text-muted">
                                  {dayName} • {formatDate(holiday.date)}
                                </p>
                              </div>
                            </div>
                            {canManage ? (
                              <div
                                className={cn(
                                  'admin-cal-item-actions ml-2 flex flex-shrink-0 gap-2 transition-opacity',
                                  useAdminLayout ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                                )}
                              >
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className={CAL_SIDEBAR_EDIT_BTN}
                                  onClick={() => handleEditHoliday(holiday)}
                                  aria-label="Edit holiday name"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  className={CAL_SIDEBAR_DELETE_BTN}
                                  onClick={() => {
                                    setHolidayToDelete(holiday)
                                    setDeleteConfirmOpen(true)
                                  }}
                                  aria-label="Delete holiday"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                  </div>
                ) : (
                  <div
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-lg border border-dashed py-1.5 text-center',
                      useAdminLayout ? 'admin-cal-empty admin-cal-empty-compact' : 'border-border bg-surface/50 py-3',
                    )}
                  >
                    <span className="text-sm opacity-50">📅</span>
                    <p className="text-[10px] font-medium text-muted">No holidays this month</p>
                  </div>
                )}
              </section>

              {!useAdminLayout ? (
                <div className="h-px flex-shrink-0 bg-border" aria-hidden />
              ) : null}

              {/* Company Events */}
              <section
                className={cn(
                  'flex min-h-0 flex-1 flex-col rounded-lg',
                  useAdminLayout && 'admin-cal-side-section--scroll',
                  sidebarEvents.length > 0 &&
                    (useAdminLayout
                      ? 'admin-cal-side-section--active admin-cal-side-section--active-events'
                      : 'border border-amber-100/90 bg-amber-50/50 px-2 py-1.5'),
                )}
              >
                <div className={cn('flex items-center gap-2', useAdminLayout && 'admin-cal-side-section-head')}>
                  <h3
                    className={cn(
                      'text-xs font-semibold',
                      useAdminLayout ? 'admin-cal-side-section-title' : 'text-ink',
                    )}
                  >
                    Company Events
                  </h3>
                  <span
                    className={cn(
                      'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                      useAdminLayout
                        ? 'admin-cal-count-badge admin-cal-count-badge-amber'
                        : 'bg-amber-100 text-amber-700',
                    )}
                  >
                    {sidebarEvents.length}
                  </span>
                  {canManage ? (
                    <button
                      type="button"
                      className="admin-cal-side-add-btn ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md border border-amber-300/80 text-amber-800 hover:bg-amber-50"
                      onClick={openAddEventForm}
                      aria-label="Add event"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>

                {sidebarEvents.length > 0 ? (
                  <div
                    className={cn(
                      'space-y-1 overflow-y-auto pr-1 custom-scrollbar',
                      useAdminLayout
                        ? 'admin-cal-side-section-list admin-cal-side-section-list--fills'
                        : 'admin-cal-side-section-list max-h-[6.75rem]',
                    )}
                  >
                    {[...sidebarEvents]
                      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
                      .map((event) => (
                        <div
                          key={event.id}
                          className={cn(
                            'group flex items-center rounded-lg border transition-all',
                            useAdminLayout
                              ? 'admin-cal-list-item border-[rgba(38,107,28,0.12)] hover:border-[rgba(38,107,28,0.28)]'
                              : 'border-border p-2 hover:border-primary/40 hover:shadow-sm',
                          )}
                        >
                          <div
                            className={cn(
                              'flex flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-amber-100 to-amber-50 text-sm font-semibold text-amber-700 shadow-sm',
                              useAdminLayout ? 'admin-cal-list-icon h-7 w-7 text-base' : 'h-7 w-7',
                            )}
                          >
                            📢
                          </div>
                          <div className="ml-2 min-w-0 flex-1">
                            <h4
                              className={cn(
                                'text-xs font-semibold text-ink',
                                useAdminLayout ? 'line-clamp-2 leading-snug' : 'truncate',
                              )}
                            >
                              {event.title}
                            </h4>
                            <p className="text-[10px] text-muted">
                              {event.time || 'All day'} • {formatDate(event.date)}
                            </p>
                          </div>
                          {canManage ? (
                            <div
                              className={cn(
                                'admin-cal-item-actions ml-2 flex flex-shrink-0 gap-2 transition-opacity',
                                useAdminLayout ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                              )}
                            >
                              <Button
                                size="sm"
                                variant="secondary"
                                className={CAL_SIDEBAR_EDIT_BTN}
                                onClick={() => handleEditEvent(event)}
                                aria-label="Edit event name"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                className={CAL_SIDEBAR_DELETE_BTN}
                                onClick={() => {
                                  setEventToDelete(event)
                                  setEventDeleteConfirmOpen(true)
                                }}
                                aria-label="Delete event"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                  </div>
                ) : (
                  <div
                    className={cn(
                      'flex flex-col items-center justify-center rounded-lg border border-dashed py-2 text-center',
                      useAdminLayout ? 'admin-cal-empty admin-cal-empty-compact' : 'border-border bg-surface/50 py-4',
                    )}
                  >
                    <span className="text-base opacity-50">📢</span>
                    <p className="text-[10px] font-medium text-muted">No events this month</p>
                  </div>
                )}
              </section>

              {!useAdminLayout ? (
                <div className="h-px flex-shrink-0 bg-border" aria-hidden />
              ) : null}

              {/* Approved Leaves */}
              <section
                className={cn(
                  'flex min-h-0 flex-1 flex-col rounded-lg',
                  useAdminLayout && 'admin-cal-side-section--scroll',
                  sidebarLeaves.length > 0 &&
                    (useAdminLayout
                      ? 'admin-cal-side-section--active admin-cal-side-section--active-leaves'
                      : 'border border-lime-100/90 bg-lime-50/50 px-2 py-1.5'),
                )}
              >
                <div className={cn('flex items-center gap-2', useAdminLayout && 'admin-cal-side-section-head')}>
                  <h3
                    className={cn(
                      'text-xs font-semibold',
                      useAdminLayout ? 'admin-cal-side-section-title' : 'text-ink',
                    )}
                  >
                    Approved Leaves
                  </h3>
                  <span
                    className={cn(
                      'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                      useAdminLayout
                        ? 'admin-cal-count-badge admin-cal-count-badge-lime'
                        : 'bg-lime-100 text-lime-700',
                    )}
                  >
                    {sidebarLeaves.length}
                  </span>
                </div>

                {sidebarLeaves.length > 0 ? (
                  <div
                    className={cn(
                      'space-y-1 overflow-y-auto pr-1 custom-scrollbar',
                      useAdminLayout
                        ? 'admin-cal-side-section-list admin-cal-side-section-list--fills'
                        : 'admin-cal-side-section-list max-h-[6.75rem]',
                    )}
                  >
                    {sidebarLeaves.map((leave) => {
                      const pastLeave = isLeaveEnded(leave)
                      return (
                      <div
                        key={leave.id}
                        className={cn(
                          'flex items-center rounded-lg border p-2 transition-all',
                          useAdminLayout
                            ? cn(
                                'admin-cal-list-item',
                                pastLeave
                                  ? 'border-border/70 opacity-75'
                                  : 'border-[rgba(38,107,28,0.12)] hover:border-[rgba(38,107,28,0.28)]',
                              )
                            : cn(
                                'border-border hover:border-primary/40 hover:shadow-sm',
                                pastLeave && 'opacity-75',
                              ),
                        )}
                      >
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-lime-100 to-lime-50 text-sm shadow-sm">
                          ✈️
                        </div>
                        <div className="ml-2 min-w-0 flex-1">
                          <h4
                            className={cn(
                              'text-xs font-semibold text-ink',
                              useAdminLayout ? 'line-clamp-2 leading-snug' : 'truncate',
                            )}
                          >
                            {formatLeavePrimaryLabel(leave, showLeaveEmployeeNames)}
                          </h4>
                          <p className="text-[10px] leading-snug text-muted">
                            {showLeaveEmployeeNames ? `${leave.type} • ${leave.days}d` : `${leave.days}d`}
                            {pastLeave ? ' • Ended' : ''}
                            {(useAdminLayout || !showLeaveEmployeeNames) && (
                              <>
                                {' '}
                                • {format(parseISO(leave.from), 'MMM d')}
                                {leave.days > 1
                                  ? ` – ${format(parseISO(leave.to), 'MMM d')}`
                                  : ''}
                              </>
                            )}
                          </p>
                        </div>
                        {canManage && pastLeave ? (
                          <Button
                            size="sm"
                            variant="danger"
                            className={cn(CAL_SIDEBAR_DELETE_BTN, 'ml-2 flex-shrink-0')}
                            onClick={() => {
                              setLeaveToDelete(leave)
                              setLeaveDeleteConfirmOpen(true)
                            }}
                            aria-label="Remove past leave record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        {!useAdminLayout ? (
                          <div className="ml-2 flex-shrink-0 text-right">
                            <span className="block text-xs font-medium text-ink">
                              {format(parseISO(leave.from), 'MMM d')}
                            </span>
                            {leave.days > 1 && (
                              <span className="block text-[10px] leading-none text-muted">
                                to {format(parseISO(leave.to), 'MMM d')}
                              </span>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )})}
                  </div>
                ) : (
                  <div
                    className={cn(
                      'flex flex-col items-center justify-center rounded-lg border border-dashed py-2 text-center',
                      useAdminLayout ? 'admin-cal-empty admin-cal-empty-compact' : 'border-border bg-surface/50 py-4',
                    )}
                  >
                    <span className="text-base opacity-50">🏖️</span>
                    <p className="text-[10px] font-medium text-muted">No approved leaves this month</p>
                  </div>
                )}
              </section>
            </div>
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
                    </div>
                  ))}
                </div>
              </div>
            )}

            {itemsOnSelectedDate.leaves.length > 0 && (
              <div>
                <h4 className="font-semibold text-ink text-sm mb-2 flex items-center gap-1.5">
                  {showLeaveEmployeeNames ? '✈️ Employees on Leave' : '✈️ Approved Leaves'}
                </h4>
                <div className="space-y-2">
                  {itemsOnSelectedDate.leaves.map((l) => (
                    <div key={l.id} className="text-sm p-3 rounded-lg bg-green-50 border border-green-100 flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-green-900">
                          {formatLeavePrimaryLabel(l, showLeaveEmployeeNames)}
                        </p>
                        <p className="text-xs text-green-700 mt-0.5">
                          {showLeaveEmployeeNames ? `${l.type} • ${l.days} days` : `${l.days} days • ${formatDate(l.from)}${l.days > 1 ? ` – ${formatDate(l.to)}` : ''}`}
                        </p>
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
      {canManage && isHolidayFormOpen && (
        <Modal
          isOpen={isHolidayFormOpen}
          onClose={() => {
            setIsHolidayFormOpen(false)
            resetHolidayForm()
          }}
          title={formTitle}
          headerActions={
            !editingId && !isEventForm ? (
              <>
                <input
                  ref={holidayImportInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={(e) => void handleHolidayImportFileChange(e.target.files)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 px-2.5 text-xs"
                  disabled={uploadingHolidayImport}
                  onClick={() => holidayImportInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  {uploadingHolidayImport ? 'Uploading…' : 'Upload Excel'}
                </Button>
              </>
            ) : undefined
          }
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                {formNameLabel} <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder={isEventForm ? 'e.g., Town Hall' : 'e.g., Independence Day'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-10"
              />
            </div>
            {!editingId && !isEventForm ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">
                    From Date <span className="text-red-500">*</span>
                  </label>
                  <DateInput
                    value={fromDate}
                    onChange={setFromDate}
                    minDate={calendarBounds.min}
                    maxDate={calendarBounds.max}
                    placeholder="dd/mm/yyyy"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">
                    To Date <span className="text-xs font-normal text-muted">(optional)</span>
                  </label>
                  <DateInput
                    value={toDate}
                    onChange={setToDate}
                    minDate={fromDate || calendarBounds.min}
                    maxDate={calendarBounds.max}
                    placeholder="dd/mm/yyyy"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">
                  Date <span className="text-red-500">*</span>
                </label>
                <DateInput
                  value={fromDate}
                  onChange={setFromDate}
                  minDate={calendarBounds.min}
                  maxDate={calendarBounds.max}
                  placeholder="dd/mm/yyyy"
                />
              </div>
            )}
            {!isEventForm ? (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">Holiday Type</label>
                <select
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as 'National' | 'Company' | 'Optional' | 'Company Event')
                  }
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                >
                  <option value="National">Public Holiday</option>
                  <option value="Company">Company Holiday</option>
                </select>
              </div>
            ) : null}
            {isEventForm && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">Time (Optional)</label>
                <Input
                  type="time"
                  placeholder="HH:mm"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            )}
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
                {formSaveLabel}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Holiday Confirmation */}
      {canManage && deleteConfirmOpen && holidayToDelete && (
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
      {canManage && eventDeleteConfirmOpen && eventToDelete && (
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

      {/* Remove past approved leave — silent cleanup, no employee notification */}
      {canManage && leaveDeleteConfirmOpen && leaveToDelete && (
        <ConfirmModal
          isOpen={leaveDeleteConfirmOpen}
          onConfirm={handleDeletePastLeave}
          onClose={() => {
            setLeaveDeleteConfirmOpen(false)
            setLeaveToDelete(null)
          }}
          title="Remove Past Leave"
          description={`Remove ${leaveToDelete.employeeName}'s past ${leaveToDelete.type} (${formatDate(leaveToDelete.from)} – ${formatDate(leaveToDelete.to)}) from records? The employee will not be notified.`}
          confirmLabel="Remove"
          danger
        />
      )}
    </Tooltip.Provider>
  )
}
