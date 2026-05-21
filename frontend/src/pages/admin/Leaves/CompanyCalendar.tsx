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

export function CompanyCalendar() {
  const { holidays, leaves, loading } = useLeaves()
  const addHoliday = useLeaveStore((s) => s.addHoliday)
  const updateHoliday = useLeaveStore((s) => s.updateHoliday)
  const deleteHoliday = useLeaveStore((s) => s.deleteHoliday)
  const fetchHolidays = useLeaveStore((s) => s.fetchHolidays)

  const [currentDate, setCurrentDate] = useState(new Date())
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
  const [type, setType] = useState<'National' | 'Company' | 'Optional'>('National')

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

  const itemsOnSelectedDate = useMemo(() => {
    if (!selectedDateStr) return { leaves: [], holidays: [] }
    return {
      leaves: approvedLeaves.filter((l) => selectedDateStr >= l.from && selectedDateStr <= l.to),
      holidays: holidays.filter((h) => h.date === selectedDateStr),
    }
  }, [selectedDateStr, approvedLeaves, holidays])

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

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left Column: Mini Calendar Grid */}
        <div className="xl:col-span-2 rounded-xl border border-border bg-white shadow-sm flex flex-col overflow-hidden">
          {/* Calendar Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-surface/30">
            <div className="flex items-center gap-3">
              <h3 className="font-display text-lg font-semibold text-ink w-36">
                {format(currentDate, 'MMMM yyyy')}
              </h3>
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" className="h-8 w-8 p-0" onClick={prevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="secondary" className="h-8 px-3 text-xs" onClick={goToToday}>
                  Today
                </Button>
                <Button size="sm" variant="secondary" className="h-8 w-8 p-0" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button size="sm" className="h-8 px-3 text-xs shadow-sm" onClick={() => setIsHolidayFormOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Holiday
            </Button>
          </div>

          {/* Legend */}
          <div className="px-5 py-2.5 border-b border-border bg-gray-50 flex flex-wrap gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-lime-400 border border-lime-500"></div>
              <span className="text-muted">Approved Leave</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
              <span className="text-muted">National Holiday</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
              <span className="text-muted">Company Holiday</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
              <span className="text-muted">Optional Holiday</span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <div className="w-2.5 h-2.5 rounded-full bg-red-100 border border-red-200"></div>
              <span className="text-muted">Multiple Absences</span>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="p-4 flex-1">
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <span className="text-sm text-muted">Loading calendar...</span>
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1.5">
                {/* Day Headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center text-xs font-semibold text-muted py-2 uppercase tracking-wider">
                    {day}
                  </div>
                ))}
                
                {/* Day Cells */}
                {calendarDays.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const dayHolidays = getHolidaysForDay(dateStr)
                  const dayLeaves = getLeavesForDay(dateStr)
                  const isCurrentMonth = isSameMonth(day, currentDate)
                  const isTodayDate = isToday(day)
                  const hasMultipleLeaves = dayLeaves.length > 1

                  return (
                    <Tooltip.Root key={dateStr}>
                      <Tooltip.Trigger asChild>
                        <div
                          onClick={() => handleDateClick(dateStr)}
                          className={`min-h-[5.5rem] p-2 rounded-lg border transition-all cursor-pointer flex flex-col gap-1 hover:shadow-sm
                            ${!isCurrentMonth ? 'bg-gray-50/40 text-muted/50 border-transparent' : 'bg-white border-border hover:border-primary/50'}
                            ${isTodayDate ? 'ring-2 ring-primary/20 border-primary/40 bg-primary/5' : ''}
                            ${hasMultipleLeaves && isCurrentMonth ? 'bg-red-50/40' : ''}
                          `}
                        >
                          <div className="flex justify-between items-start">
                            <span className={`text-sm font-semibold ${isTodayDate ? 'text-primary' : 'text-ink'}`}>
                              {format(day, 'd')}
                            </span>
                            {/* Holiday Dots */}
                            <div className="flex gap-0.5">
                              {dayHolidays.map((h, i) => (
                                <div
                                  key={i}
                                  className={`h-2 w-2 rounded-full ${
                                    h.type === 'National' ? 'bg-green-500' : h.type === 'Company' ? 'bg-blue-500' : 'bg-orange-500'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Events List inside cell */}
                          <div className="flex-1 overflow-hidden flex flex-col gap-1 mt-1">
                            {dayHolidays.slice(0, 1).map((h) => (
                              <div key={h.id} className="text-[10px] font-medium leading-tight truncate px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                                {h.title}
                              </div>
                            ))}
                            {dayLeaves.slice(0, 2).map((l) => (
                              <div key={l.id} className="text-[10px] leading-tight truncate px-1.5 py-0.5 rounded bg-lime-100 text-lime-800 border border-lime-200/50">
                                {l.employeeName.split(' ').map((n) => n[0]).join('')} - {l.type.split(' ')[0]}
                              </div>
                            ))}
                            {dayLeaves.length > 2 && (
                              <div className="text-[10px] font-semibold text-muted pl-1">
                                +{dayLeaves.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      </Tooltip.Trigger>
                      
                      {/* Hover Tooltip for Day Details */}
                      {(dayHolidays.length > 0 || dayLeaves.length > 0) && (
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
                                        <div className={`h-1.5 w-1.5 rounded-full ${h.type === 'National' ? 'bg-green-500' : h.type === 'Company' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                                        <span className="text-ink text-xs font-medium">{h.title}</span>
                                        <span className="text-muted text-[10px]">({h.type})</span>
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
            )}
          </div>
        </div>

        {/* Right Column: Side Panel for Lists */}
        <div className="xl:col-span-1 flex flex-col gap-5">
          {/* Holidays List */}
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm flex flex-col min-h-[16rem]">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-sm font-semibold text-ink">
                  {format(currentDate, 'MMM yyyy')} Holidays
                </h3>
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                  {currentMonthHolidays.length}
                </span>
              </div>
            </div>

            {currentMonthHolidays.length > 0 ? (
              <div className="space-y-2.5 overflow-y-auto pr-1 custom-scrollbar flex-1 max-h-[400px]">
                {currentMonthHolidays
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((holiday) => {
                    const holidayDate = new Date(holiday.date)
                    const dayName = format(holidayDate, 'EEE')

                    return (
                      <div
                        key={holiday.id}
                        className="group flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/40 hover:shadow-sm transition-all"
                      >
                        <div className="flex-1 flex items-center gap-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-md text-base font-bold text-white flex-shrink-0 shadow-sm ${
                            holiday.type === 'National' ? 'bg-green-500' :
                            holiday.type === 'Company' ? 'bg-blue-500' :
                            'bg-orange-500'
                          }`}>
                            🎉
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-ink text-sm truncate">{holiday.title}</h4>
                            <p className="text-xs text-muted mt-0.5">{dayName} • {formatDate(holiday.date)}</p>
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 w-7 p-0"
                            onClick={() => handleEditHoliday(holiday)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setHolidayToDelete(holiday)
                              setDeleteConfirmOpen(true)
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-surface/50 p-6 flex flex-col items-center justify-center text-center flex-1">
                <span className="text-2xl mb-2 opacity-50">📅</span>
                <p className="text-muted text-sm font-medium">No holidays this month</p>
              </div>
            )}
          </div>

          {/* Approved Leaves List */}
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm flex flex-col min-h-[16rem]">
             <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-ink">
                Approved Leaves - {format(currentDate, 'MMM yyyy')}
              </h3>
            </div>

            {approvedLeaves.length > 0 ? (
              <div className="space-y-2.5 overflow-y-auto pr-1 custom-scrollbar flex-1 max-h-[400px]">
                {approvedLeaves
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
                  .map((leave) => (
                    <div
                      key={leave.id}
                      className="flex items-center p-3 rounded-lg border border-border hover:border-primary/40 hover:shadow-sm transition-all"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-lime-100 to-lime-50 flex-shrink-0 text-base shadow-sm">
                        ✈️
                      </div>
                      <div className="flex-1 ml-3 min-w-0">
                        <h4 className="font-semibold text-ink text-sm truncate">{leave.employeeName}</h4>
                        <p className="text-xs text-muted mt-0.5">{leave.type} • {leave.days}d</p>
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <span className="text-xs font-medium text-ink block">{format(new Date(leave.from), 'MMM d')}</span>
                        {leave.days > 1 && <span className="text-[10px] text-muted block">to {format(new Date(leave.to), 'MMM d')}</span>}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-surface/50 p-6 flex flex-col items-center justify-center text-center flex-1">
                 <span className="text-2xl mb-2 opacity-50">🏖️</span>
                <p className="text-muted text-sm font-medium">No approved leaves</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals remain unchanged below this line but I will include them */}
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
                    <div key={h.id} className="text-sm p-3 rounded-lg bg-blue-50 border border-blue-100 flex justify-between items-center">
                      <span className="font-medium text-blue-900">{h.title}</span>
                      <Badge variant={h.type === 'National' ? 'success' : 'primary'}>{h.type}</Badge>
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

            {itemsOnSelectedDate.leaves.length === 0 && itemsOnSelectedDate.holidays.length === 0 && (
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
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'National' | 'Company' | 'Optional')}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
              >
                <option value="National">National</option>
                <option value="Company">Company</option>
                <option value="Optional">Optional</option>
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

      {/* Delete Confirmation */}
      {deleteConfirmOpen && holidayToDelete && (
        <ConfirmModal
          isOpen={deleteConfirmOpen}
          onConfirm={handleDeleteHoliday}
          onCancel={() => {
            setDeleteConfirmOpen(false)
            setHolidayToDelete(null)
          }}
          title="Delete Holiday"
          message={`Are you sure you want to delete "${holidayToDelete.title}"? This action cannot be undone.`}
          confirmText="Delete Holiday"
          cancelText="Keep Holiday"
        />
      )}
    </Tooltip.Provider>
  )
}
