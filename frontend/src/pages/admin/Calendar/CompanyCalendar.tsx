import { useState, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventInput } from '@fullcalendar/core'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { DateInput } from '@components/shared/DateInput'
import { getCalendarEntryBounds, validateIsoInRange } from '@/utils/dateValidation'
import { Badge } from '@components/ui/Badge'
import { useLeaves } from '@hooks/useLeaves'
import { formatDate } from '@/utils/formatDate'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'

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

export function CompanyCalendar() {
  const { leaves, holidays } = useLeaves()
  const [events, setEvents] = useState<CompanyEvent[]>(seedEvents)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [desc, setDesc] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date(2026, 4, 21))
  const calendarBounds = getCalendarEntryBounds()

  // Get month/year for sidebar
  const currentMonth = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const currentMonthYear = { month: currentDate.getMonth(), year: currentDate.getFullYear() }

  // Filter holidays for current month
  const monthHolidays = useMemo(() => {
    return holidays.filter((h) => {
      const hDate = new Date(h.date)
      return hDate.getMonth() === currentMonthYear.month && hDate.getFullYear() === currentMonthYear.year
    })
  }, [holidays, currentMonthYear])

  // Filter company events for current month — kept for future use
  // const monthEvents = useMemo(() => { ... }, [events, currentMonthYear])

  // Get today's date
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // Get today's events
  const todayEvents = useMemo(() => {
    return events.filter((e) => e.date === todayStr)
  }, [events, todayStr])

  // Get who's on leave today
  const todayLeaves = useMemo(() => {
    return leaves.filter((l) => {
      const fromDate = new Date(l.from).toISOString().split('T')[0]
      const toDate = new Date(l.to).toISOString().split('T')[0]
      return fromDate <= todayStr && todayStr <= toDate && l.status === 'Approved'
    })
  }, [leaves, todayStr])

  // Combined calendar events
  const calendarEvents: EventInput[] = useMemo(() => {
    const holidayEvents = holidays.map((h) => ({
      id: `holiday-${h.id}`,
      title: h.title,
      start: h.date,
      allDay: true,
      backgroundColor:
        h.type === 'National'
          ? '#266b1c'
          : h.type === 'Company'
          ? '#0066cc'
          : h.type === 'Company Event'
          ? '#f97316'
          : '#f97316',
      borderColor:
        h.type === 'National'
          ? '#266b1c'
          : h.type === 'Company'
          ? '#0066cc'
          : h.type === 'Company Event'
          ? '#f97316'
          : '#f97316',
    }))

    const companyEvents = events.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.time ? `${e.date}T${e.time}:00` : e.date,
      allDay: !e.time,
      backgroundColor: '#f59e0b',
      borderColor: '#f59e0b',
    }))

    return [...holidayEvents, ...companyEvents]
  }, [holidays, events])

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() - 1)
    setCurrentDate(newDate)
  }

  const handleNextMonth = () => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() + 1)
    setCurrentDate(newDate)
  }

  const handlePrevDay = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 1)
    setCurrentDate(newDate)
  }

  const handleNextDay = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 1)
    setCurrentDate(newDate)
  }

  return (
    <PageWrapper>
      <PageHeader
        title=""
        subtitle="View holidays, events, and team leave status"
        breadcrumb={<Breadcrumb items={[{ label: 'Calendar' }]} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
              height="auto"
              events={calendarEvents}
              eventClick={(info) => {
                toast.message(info.event.title, { description: info.event.startStr })
              }}
              dateClick={() => setOpen(true)}
            />
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-3">
          {/* Month Navigation */}
          <div className="rounded-lg border border-border bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-ink">{currentMonth}</h3>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={handlePrevMonth} className="flex-1">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="sm" onClick={handleNextMonth} className="flex-1">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Day Navigation */}
          <div className="rounded-lg border border-border bg-white p-3 shadow-sm">
            <div className="mb-2">
              <p className="text-xs font-medium text-muted uppercase tracking-wide">Navigate Days</p>
              <p className="text-xs font-medium text-ink">{formatDate(currentDate.toISOString().split('T')[0])}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={handlePrevDay} className="flex-1">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="sm" onClick={handleNextDay} className="flex-1">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Holidays for Month */}
          <div className="rounded-lg border border-border bg-white p-3 shadow-sm">
            <h4 className="mb-2 text-xs font-semibold text-ink">Holidays ({monthHolidays.length})</h4>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {monthHolidays.length > 0 ? (
                monthHolidays.map((h) => (
                  <div key={h.id} className="rounded-lg border border-border/50 bg-surface/50 p-2">
                    <p className="text-sm font-medium text-ink">{h.title}</p>
                    <p className="text-xs text-muted">{formatDate(h.date)}</p>
                    <Badge variant={h.type === 'National' ? 'success' : h.type === 'Company' ? 'info' : 'neutral'} className="mt-1 text-xs">
                      {h.type}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">No holidays this month</p>
              )}
            </div>
          </div>

          {/* Today's Events */}
          <div className="rounded-lg border border-border bg-white p-3 shadow-sm">
            <h4 className="mb-2 text-xs font-semibold text-ink">Today's Events</h4>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {todayEvents.length > 0 ? (
                todayEvents.map((e) => (
                  <div key={e.id} className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                    <p className="text-sm font-medium text-ink">{e.title}</p>
                    {e.time && <p className="text-xs text-muted">{e.time}</p>}
                    {e.description && <p className="mt-1 text-xs text-muted">{e.description}</p>}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">No events today</p>
              )}
            </div>
          </div>

          {/* Who's on Leave Today */}
          <div className="rounded-lg border border-border bg-white p-3 shadow-sm">
            <h4 className="mb-2 text-xs font-semibold text-ink">On Leave Today</h4>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {todayLeaves.length > 0 ? (
                todayLeaves.map((l) => (
                  <div key={l.id} className="rounded-lg border border-border/50 bg-red-50 p-2">
                    <p className="text-sm font-medium text-ink">{l.employeeName}</p>
                    <p className="text-xs text-muted">{l.type}</p>
                    <p className="text-xs text-muted">{l.leaveDuration}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">No one on leave today</p>
              )}
            </div>
          </div>

          {/* Add Event Button */}
          <Button onClick={() => setOpen(true)} className="w-full">
            Add Event
          </Button>
        </div>
      </div>

      {/* Add Event Modal */}
      <Modal isOpen={open} title="Add Event" onClose={() => setOpen(false)}>
        <div className="grid gap-3">
          <Input label="Event Name" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">Date</span>
            <DateInput
              value={date}
              onChange={setDate}
              minDate={calendarBounds.min}
              maxDate={calendarBounds.max}
              placeholder="dd/mm/yyyy"
            />
          </div>
          <Input label="Time (Optional)" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <label className="text-sm font-medium text-ink">
            Description
            <textarea
              className="mt-1 min-h-[80px] w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!title || !date) {
                  toast.error('Add title and date')
                  return
                }
                const dateCheck = validateIsoInRange(date, calendarBounds.min, calendarBounds.max)
                if (!dateCheck.valid) {
                  toast.error(dateCheck.error)
                  return
                }
                setEvents((e) => [
                  ...e,
                  { id: String(Date.now()), title, date, time, description: desc },
                ])
                setOpen(false)
                setTitle('')
                setDate('')
                setTime('')
                setDesc('')
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}
