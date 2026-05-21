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
  isSameMonth,
  isToday,
} from 'date-fns'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Badge } from '@components/ui/Badge'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Plus, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { formatDate } from '@/utils/formatDate'
import type { Holiday } from '@/types'
import { useLeaveStore } from '@store/leaveStore'

interface CompanyEvent {
  id: string
  title: string
  date: string
  time?: string
  description?: string
}

const seedEvents: CompanyEvent[] = [
  { id: '1', title: 'Town hall', date: '2026-05-20', time: '10:00' },
  { id: '2', title: 'Leadership sync', date: '2026-05-22', time: '15:00' },
]

export function AdminCalendarView() {
  const { leaves, holidays } = useLeaves()
  const addHoliday = useLeaveStore((s) => s.addHoliday)
  const updateHoliday = useLeaveStore((s) => s.updateHoliday)
  const deleteHoliday = useLeaveStore((s) => s.deleteHoliday)
  const fetchHolidays = useLeaveStore((s) => s.fetchHolidays)

  const [currentDate, setCurrentDate] = useState(new Date(2026, 4, 21))
  const [events, setEvents] = useState<CompanyEvent[]>(seedEvents)
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null)
  const [isDateModalOpen, setIsDateModalOpen] = useState(false)
  const [isHolidayFormOpen, setIsHolidayFormOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [holidayToDelete, setHolidayToDelete] = useState<Holiday | null>(null)

  // Holiday form state
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'Government' | 'Company'>('Government')

  // Calendar logic
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const goToToday = () => setCurrentDate(new Date())

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

  const currentMonthIdx = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  // Get approved leaves
  const approvedLeaves = useMemo(() => {
    return leaves.filter((l) => l.status === 'Approved')
  }, [leaves])

  const getHolidaysForDay = (dateStr: string) => holidays.filter((h) => h.date === dateStr)
  const getLeavesForDay = (dateStr: string) =>
    approvedLeaves.filter((l) => dateStr >= l.from && dateStr <= l.to)
  const getEventsForDay = (dateStr: string) => events.filter((e) => e.date === dateStr)

  const itemsOnSelectedDate = useMemo(() => {
    if (!selectedDateStr) return { leaves: [], holidays: [], events: [] }
    return {
      leaves: approvedLeaves.filter((l) => selectedDateStr >= l.from && selectedDateStr <= l.to),
      holidays: holidays.filter((h) => h.date === selectedDateStr),
      events: events.filter((e) => e.date === selectedDateStr),
    }
  }, [selectedDateStr, approvedLeaves, holidays, events])

  const handleDateClick = (dateStr: string) => {
    setSelectedDateStr(dateStr)
    setIsDateModalOpen(true)
  }

  const resetHolidayForm = () => {
    setTitle('')
    setDate('')
    setDescription('')
    setType('Government')
    setEditingId(null)
  }

  const handleAddHoliday = async () => {
    if (!title.trim() || !date) {
      toast.error('Please fill holiday name and date')
      return
    }

    try {
      if (editingId) {
        await updateHoliday(editingId, { title, date, description, type })
        toast.success('Holiday updated')
      } else {
        await addHoliday({ title, date, description, type })
        toast.success('Holiday added')
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
      toast.success('Holiday deleted')
      setDeleteConfirmOpen(false)
      setHolidayToDelete(null)
      fetchHolidays()
    } catch {
      toast.error('Failed to delete holiday')
    }
  }

  const currentMonthHolidays = useMemo(() => {
    return holidays.filter((h) => {
      const holidayDate = new Date(h.date)
      return holidayDate.getMonth() === currentMonthIdx && holidayDate.getFullYear() === currentYear
    })
  }, [holidays, currentMonthIdx, currentYear])

  const currentMonthEvents = useMemo(() => {
    return events.filter((e) => {
      const eventDate = new Date(e.date)
      return eventDate.getMonth() === currentMonthIdx && eventDate.getFullYear() === currentYear
    })
  }, [events, currentMonthIdx, currentYear])

  const currentMonthLeaves = useMemo(() => {
    return approvedLeaves.filter((l) => {
      const fromDate = new Date(l.from)
      const toDate = new Date(l.to)
      return (
        (fromDate.getMonth() === currentMonthIdx && fromDate.getFullYear() === currentYear) ||
        (toDate.getMonth() === currentMonthIdx && toDate.getFullYear() === currentYear) ||
        (fromDate < monthStart && toDate > monthEnd)
      )
    })
  }, [approvedLeaves, currentMonthIdx, currentYear, monthStart, monthEnd])

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="flex flex-col gap-4">
        {/* Calendar Grid - Full Width */}
        <div className="rounded-xl border border-border bg-white shadow-sm flex flex-col overflow-hidden">
          {/* Calendar Header */}
          <div className="p-3 border-b border-border flex items-center justify-between bg-surface/30">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-semibold text-ink w-32">
                {format(currentDate, 'MMMM yyyy')}
              </h3>
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" className="h-7 w-7 p-0" onClick={prevMonth}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={goToToday}>
                  Today
                </Button>
                <Button size="sm" variant="secondary" className="h-7 w-7 p-0" onClick={nextMonth}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <Button size="sm" className="h-7 px-2.5 text-xs shadow-sm" onClick={() => setIsHolidayFormOpen(true)}>
              <Plus className="h-3 w-3 mr-1" /> Add Holiday
            </Button>
          </div>

          {/* Legend */}
          <div className="px-4 py-2 border-b border-border bg-gray-50 flex flex-wrap gap-3 text-xs font-medium">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-lime-400 border border-lime-500"></div>
              <span className="text-muted">Leave</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-muted">Gov Holiday</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-muted">Co Holiday</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              <span className="text-muted">Event</span>
            </div>
          </div>

          {/* Calendar Grid - Compact */}
          <div className="p-3 flex-1">
            <div className="grid grid-cols-7 gap-1">
              {/* Day Headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-xs font-semibold text-muted py-1.5 uppercase tracking-wider">
                  {day}
                </div>
              ))}
              
              {/* Day Cells */}
              {calendarDays.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const dayHolidays = getHolidaysForDay(dateStr)
                const dayLeaves = getLeavesForDay(dateStr)
                const dayEvents = getEventsForDay(dateStr)
                const isCurrentMonth = isSameMonth(day, currentDate)
                const isTodayDate = isToday(day)

                return (
                  <Tooltip.Root key={dateStr}>
                    <Tooltip.Trigger asChild>
                      <div
                        onClick={() => handleDateClick(dateStr)}
                        className={`min-h-[4rem] p-1.5 rounded border transition-all cursor-pointer flex flex-col gap-0.5 hover:shadow-sm
                          ${!isCurrentMonth ? 'bg-gray-50/40 text-muted/50 border-transparent' : 'bg-white border-border hover:border-primary/50'}
                          ${isTodayDate ? 'ring-2 ring-primary/20 border-primary/40 bg-primary/5' : ''}
                        `}
                      >
                        <div className="flex justify-between items-start">
                          <span className={`text-xs font-semibold ${isTodayDate ? 'text-primary' : 'text-ink'}`}>
                            {format(day, 'd')}
                          </span>
                          <div className="flex gap-0.5">
                            {dayHolidays.map((h, i) => (
                              <div key={i} className={`h-1.5 w-1.5 rounded-full ${h.type === 'Government' ? 'bg-green-500' : 'bg-blue-500'}`} />
                            ))}
                            {dayEvents.map((e, i) => (
                              <div key={`event-${i}`} className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            ))}
                          </div>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col gap-0.5 mt-0.5">
                          {dayLeaves.slice(0, 1).map((l) => (
                            <div key={l.id} className="text-[8px] leading-tight truncate px-1 py-0.5 rounded bg-lime-100 text-lime-800 border border-lime-200/50">
                              {l.employeeName.split(' ')[0]}
                            </div>
                          ))}
                        </div>
                      </div>
                    </Tooltip.Trigger>
                    
                    {(dayHolidays.length > 0 || dayLeaves.length > 0 || dayEvents.length > 0) && (
                      <Tooltip.Portal>
                        <Tooltip.Content className="z-[100] max-w-sm rounded-xl bg-white p-3 text-sm shadow-xl ring-1 ring-black/5" sideOffset={5}>
                          <div className="space-y-2">
                            <p className="font-semibold text-ink border-b border-border pb-1">{format(day, 'EEE, MMM d')}</p>
                            {dayHolidays.length > 0 && (
                              <div className="space-y-1">
                                {dayHolidays.map((h) => (
                                  <div key={h.id} className="text-xs"><span className="font-medium">{h.title}</span> <span className="text-muted">({h.type})</span></div>
                                ))}
                              </div>
                            )}
                            {dayLeaves.length > 0 && (
                              <div className="space-y-1">
                                {dayLeaves.map((l) => (
                                  <div key={l.id} className="text-xs"><span className="font-medium">{l.employeeName}</span> <span className="text-muted">({l.type})</span></div>
                                ))}
                              </div>
                            )}
                          </div>
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    )}
                  </Tooltip.Root>
                )
              })}
            </div>
          </div>
        </div>

        {/* Bottom Row: Holidays (left) and Events (right) - Side by Side */}
        <div className="grid grid-cols-2 gap-4">
          {/* Holidays List */}
          <div className="rounded-xl border border-border bg-white p-3 shadow-sm flex flex-col h-64">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="font-display text-xs font-semibold text-ink">{format(currentDate, 'MMM')} Holidays</h3>
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full text-[8px] font-bold bg-blue-100 text-blue-700">
                {currentMonthHolidays.length}
              </span>
            </div>

            {currentMonthHolidays.length > 0 ? (
              <div className="space-y-1.5 overflow-y-auto pr-2 flex-1 scrollbar scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                {currentMonthHolidays.map((holiday) => (
                  <div key={holiday.id} className="group flex items-center justify-between p-2 rounded-lg border border-border hover:border-primary/40 transition-all">
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <div className={`flex h-7 w-7 items-center justify-center rounded text-white flex-shrink-0 shadow-sm text-xs font-semibold ${
                        holiday.type === 'Government' ? 'bg-green-500' : 'bg-blue-500'
                      }`}>
                        H
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-ink text-xs truncate">{holiday.title}</h4>
                        <p className="text-xs text-muted mt-0.5">{formatDate(holiday.date)}</p>
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
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-surface/50 p-4 flex items-center justify-center text-center flex-1">
                <p className="text-muted text-xs">No holidays</p>
              </div>
            )}
          </div>

          {/* Company Events List */}
          <div className="rounded-xl border border-border bg-white p-3 shadow-sm flex flex-col h-64">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="font-display text-xs font-semibold text-ink">Events</h3>
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full text-[8px] font-bold bg-amber-100 text-amber-700">
                {currentMonthEvents.length}
              </span>
            </div>

            {currentMonthEvents.length > 0 ? (
              <div className="space-y-1.5 overflow-y-auto pr-2 flex-1 scrollbar scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                {currentMonthEvents.map((event) => (
                  <div key={event.id} className="flex items-center p-2 rounded-lg border border-border hover:border-primary/40 transition-all">
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-gradient-to-br from-amber-100 to-amber-50 flex-shrink-0 text-xs shadow-sm font-semibold text-amber-700">
                      E
                    </div>
                    <div className="flex-1 ml-2 min-w-0">
                      <h4 className="font-semibold text-ink text-xs truncate">{event.title}</h4>
                      <p className="text-xs text-muted mt-0.5">{event.time || 'All day'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-surface/50 p-4 flex items-center justify-center text-center flex-1">
                <p className="text-muted text-xs">No events</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Full Width: Approved Leaves */}
        <div className="rounded-xl border border-border bg-white p-3 shadow-sm flex flex-col">
          <h3 className="font-display text-xs font-semibold text-ink mb-2">
            Approved Leaves ({currentMonthLeaves.length})
          </h3>

          {currentMonthLeaves.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-40 overflow-y-auto scrollbar scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {currentMonthLeaves.map((leave) => (
                <div key={leave.id} className="flex items-center p-2 rounded-lg border border-border hover:border-primary/40 transition-all">
                  <div className="flex h-7 w-7 items-center justify-center rounded bg-gradient-to-br from-lime-100 to-lime-50 flex-shrink-0 text-xs shadow-sm font-semibold text-lime-700">
                    L
                  </div>
                  <div className="flex-1 ml-2 min-w-0">
                    <h4 className="font-semibold text-ink text-xs truncate">{leave.employeeName}</h4>
                    <p className="text-xs text-muted">{leave.days}d • {leave.type}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-surface/50 p-4 text-center">
              <p className="text-muted text-xs">No approved leaves</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {isDateModalOpen && selectedDateStr && (
        <Modal isOpen={isDateModalOpen} onClose={() => setIsDateModalOpen(false)} title="Day Details">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-1">Date</p>
              <p className="text-sm font-semibold text-ink">{format(new Date(selectedDateStr), 'EEEE, MMMM d, yyyy')}</p>
            </div>
            {itemsOnSelectedDate.holidays.length > 0 && (
              <div>
                <h4 className="font-semibold text-ink text-sm mb-2">Holidays</h4>
                <div className="space-y-2">
                  {itemsOnSelectedDate.holidays.map((h) => (
                    <div key={h.id} className="text-sm p-2 rounded-lg bg-blue-50 border border-blue-100">
                      <span className="font-medium text-blue-900">{h.title}</span>
                      <Badge variant={h.type === 'Government' ? 'success' : 'info'} className="ml-2 text-xs">{h.type}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {itemsOnSelectedDate.leaves.length > 0 && (
              <div>
                <h4 className="font-semibold text-ink text-sm mb-2">Employees on Leave</h4>
                <div className="space-y-2">
                  {itemsOnSelectedDate.leaves.map((l) => (
                    <div key={l.id} className="text-sm p-2 rounded-lg bg-green-50 border border-green-100">
                      <p className="font-semibold text-green-900">{l.employeeName}</p>
                      <p className="text-xs text-green-700 mt-0.5">{l.type} • {l.days} days</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {isHolidayFormOpen && (
        <Modal isOpen={isHolidayFormOpen} onClose={() => { setIsHolidayFormOpen(false); resetHolidayForm() }} title={editingId ? 'Edit Holiday' : 'Add Holiday'}>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Holiday Name</label>
              <Input placeholder="e.g., Independence Day" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as 'Government' | 'Company')} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="Government">Government Holiday</option>
                <option value="Company">Company Holiday</option>
              </select>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="secondary" onClick={() => { setIsHolidayFormOpen(false); resetHolidayForm() }}>Cancel</Button>
              <Button onClick={handleAddHoliday}>{editingId ? 'Update' : 'Save'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteConfirmOpen && holidayToDelete && (
        <ConfirmModal isOpen={deleteConfirmOpen} onConfirm={handleDeleteHoliday} onCancel={() => { setDeleteConfirmOpen(false); setHolidayToDelete(null) }} title="Delete Holiday" description={`Delete "${holidayToDelete.title}"?`} confirmLabel="Delete" cancelLabel="Cancel" danger />
      )}
    </Tooltip.Provider>
  )
}
