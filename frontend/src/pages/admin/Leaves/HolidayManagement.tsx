import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Edit2, Trash2, SkipForward, RotateCcw } from 'lucide-react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventInput } from '@fullcalendar/core'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { Badge } from '@components/ui/Badge'
import { DataTable, type Column } from '@components/tables/DataTable'
import { useLeaveStore } from '@store/leaveStore'
import { formatDate } from '@/utils/formatDate'
import type { Holiday } from '@/types'

export function HolidayManagement() {
  const holidays = useLeaveStore((s) => s.holidays)
  const addHoliday = useLeaveStore((s) => s.addHoliday)
  const updateHoliday = useLeaveStore((s) => s.updateHoliday)
  const deleteHoliday = useLeaveStore((s) => s.deleteHoliday)
  const skipHoliday = useLeaveStore((s) => s.skipHoliday)
  const fetchHolidays = useLeaveStore((s) => s.fetchHolidays)

  // Modal state
  const [formOpen, setFormOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [skipModalOpen, setSkipModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [holidayToDelete, setHolidayToDelete] = useState<Holiday | null>(null)
  const [holidayToSkip, setHolidayToSkip] = useState<Holiday | null>(null)
  const [skipReason, setSkipReason] = useState('')

  // Form state
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'National' | 'Company' | 'Optional'>('National')

  // Calendar state
  const [calendarOpen, setCalendarOpen] = useState(true)
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear())

  // Loading state
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchHolidays()
  }, [fetchHolidays])

  const events: EventInput[] = useMemo(
    () =>
      holidays.map((h) => ({
        id: h.id,
        title: h.skipped ? `${h.title} (Working Day)` : h.title,
        start: h.date,
        allDay: true,
        backgroundColor: h.skipped
          ? '#94a3b8'
          : h.type === 'National'
          ? '#16a34a'
          : h.type === 'Company'
          ? '#0066cc'
          : '#f97316',
        borderColor: h.skipped
          ? '#64748b'
          : h.type === 'National'
          ? '#16a34a'
          : h.type === 'Company'
          ? '#0066cc'
          : '#f97316',
        textColor: '#ffffff',
        classNames: h.skipped ? ['opacity-60'] : [],
      })),
    [holidays],
  )

  const filteredHolidays = useMemo(() => {
    return holidays.filter((h) => {
      const d = new Date(h.date)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })
  }, [holidays, currentMonth, currentYear])

  const resetForm = () => {
    setTitle('')
    setDate('')
    setDescription('')
    setType('National')
    setEditingId(null)
  }

  const handleOpenAdd = () => {
    resetForm()
    setFormOpen(true)
  }

  const handleOpenEdit = (holiday: Holiday) => {
    setTitle(holiday.title)
    setDate(holiday.date)
    setDescription(holiday.description || '')
    setType(holiday.type as any)
    setEditingId(holiday.id)
    setFormOpen(true)
  }

  const handleOpenDelete = (holiday: Holiday) => {
    setHolidayToDelete(holiday)
    setDeleteConfirmOpen(true)
  }

  const handleOpenSkip = (holiday: Holiday) => {
    if (holiday.skipped) {
      // Restore immediately — no reason needed
      void handleToggleSkip(holiday, '')
    } else {
      setHolidayToSkip(holiday)
      setSkipReason('')
      setSkipModalOpen(true)
    }
  }

  const handleToggleSkip = async (holiday: Holiday, reason: string) => {
    setIsLoading(true)
    try {
      await skipHoliday(holiday.id, reason)
      const action = holiday.skipped ? 'restored as a holiday' : 'marked as a working day'
      toast.success(`"${holiday.title}" has been ${action}`)
      setSkipModalOpen(false)
      setHolidayToSkip(null)
      setSkipReason('')
    } catch {
      toast.error('Failed to update holiday status')
    } finally {
      setIsLoading(false)
    }
  }

  const validateForm = (): boolean => {
    if (!title.trim()) {
      toast.error('Holiday name is required')
      return false
    }
    if (!date) {
      toast.error('Date is required')
      return false
    }
    return true
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setIsLoading(true)
    try {
      if (editingId) {
        await updateHoliday(editingId, { title, date, description, type })
        toast.success('Holiday updated successfully')
      } else {
        const exists = holidays.some((h) => h.date === date && h.id !== editingId)
        if (exists) {
          toast.error('Holiday already exists on this date')
          setIsLoading(false)
          return
        }
        await addHoliday({ title, date, description, type })
        toast.success('Holiday added successfully')
      }
      resetForm()
      setFormOpen(false)
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast.error('Holiday already exists on this date')
      } else {
        toast.error(editingId ? 'Failed to update holiday' : 'Failed to add holiday')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!holidayToDelete) return

    setIsLoading(true)
    try {
      await deleteHoliday(holidayToDelete.id)
      toast.success('Holiday deleted successfully')
      setDeleteConfirmOpen(false)
      setHolidayToDelete(null)
    } catch {
      toast.error('Failed to delete holiday')
    } finally {
      setIsLoading(false)
    }
  }

  const typeVariant = (t: string): 'danger' | 'success' | 'warning' | 'info' | 'neutral' => {
    switch (t) {
      case 'National': return 'success'
      case 'Company': return 'info'
      case 'Company Event': return 'warning'
      case 'Optional': return 'warning'
      default: return 'neutral'
    }
  }

  const columns: Column<Holiday>[] = [
    {
      key: 'title',
      header: 'Holiday Name',
      sortable: true,
      render: (h) => (
        <div className="flex items-center gap-2">
          <span className={`font-medium text-ink ${h.skipped ? 'line-through opacity-50' : ''}`}>
            {h.title}
          </span>
          {h.skipped && (
            <Badge variant="neutral" className="text-xs">Working Day</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (h) => (
        <span className={`text-muted ${h.skipped ? 'line-through opacity-50' : ''}`}>
          {formatDate(h.date)}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (h) => <span className="text-sm text-muted">{h.description || '—'}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (h) => <Badge variant={typeVariant(h.type)}>{h.type}</Badge>,
    },
    {
      key: 'actions',
      header: 'ACTIONS',
      className: 'w-40',
      render: (h) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenEdit(h)}
            title="Edit holiday"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenSkip(h)}
            title={h.skipped ? 'Restore holiday' : 'Mark as working day'}
            className={h.skipped ? 'text-primary' : 'text-amber-600 hover:text-amber-700'}
          >
            {h.skipped ? (
              <RotateCcw className="h-4 w-4" />
            ) : (
              <SkipForward className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenDelete(h)}
            title="Delete holiday"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Add Button */}
      <div className="flex justify-end">
        <Button onClick={handleOpenAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {/* Calendar View */}
      <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-ink">Calendar View</h3>
          <Button variant="secondary" size="sm" onClick={() => setCalendarOpen(!calendarOpen)}>
            {calendarOpen ? 'Hide' : 'Show'}
          </Button>
        </div>
        {calendarOpen && (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
            height="auto"
            events={events}
            datesSet={(arg) => {
              setCurrentMonth(arg.view.currentStart.getMonth())
              setCurrentYear(arg.view.currentStart.getFullYear())
            }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-surface/50 px-4 py-3 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-green-600" /> National</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-blue-600" /> Company</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-orange-500" /> Optional / Event</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-slate-400" /> Skipped (Working Day)</span>
      </div>

      {/* Holidays Table */}
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <h3 className="mb-4 font-semibold text-ink">Holidays List</h3>
        <DataTable data={filteredHolidays} columns={columns} empty="No holidays this month." />
      </div>

      {/* Add/Edit Form Modal */}
      <Modal
        isOpen={formOpen}
        title={editingId ? 'Edit Holiday' : 'Add Holiday'}
        onClose={() => { setFormOpen(false); resetForm() }}
      >
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-2">Holiday Name *</label>
            <Input
              placeholder="e.g., Independence Day"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-2">Date *</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-2">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="National">National Holiday</option>
              <option value="Company">Company Holiday</option>
              <option value="Company Event">Company Event</option>
              <option value="Optional">Optional Holiday</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-2">Description</label>
            <textarea
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[90px] w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setFormOpen(false); resetForm() }} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Saving...' : editingId ? 'Update' : 'Add'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Skip (Mark as Working Day) Modal */}
      <Modal
        isOpen={skipModalOpen}
        title="Mark as Working Day"
        onClose={() => { setSkipModalOpen(false); setHolidayToSkip(null); setSkipReason('') }}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            You are about to mark{' '}
            <strong className="text-ink">"{holidayToSkip?.title}"</strong> on{' '}
            <strong className="text-ink">{holidayToSkip ? formatDate(holidayToSkip.date) : ''}</strong>{' '}
            as a working day. All employees will be notified.
          </p>
          <div>
            <label className="block text-sm font-medium text-ink mb-2">Reason (Optional)</label>
            <textarea
              placeholder="e.g., Project deadline, client requirement..."
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              className="min-h-[80px] w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => { setSkipModalOpen(false); setHolidayToSkip(null); setSkipReason('') }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="warning"
              onClick={() => holidayToSkip && handleToggleSkip(holidayToSkip, skipReason)}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Mark as Working Day'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Delete Holiday"
        description={`Are you sure you want to delete "${holidayToDelete?.title}" on ${
          holidayToDelete ? formatDate(holidayToDelete.date) : ''
        }? All employees will be notified. This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        onClose={() => { setDeleteConfirmOpen(false); setHolidayToDelete(null) }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
