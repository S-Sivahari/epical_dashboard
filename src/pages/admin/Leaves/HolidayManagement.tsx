import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventInput } from '@fullcalendar/core'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import { useLeaveStore } from '@store/leaveStore'
import { formatDate } from '@/utils/formatDate'

export function HolidayManagement() {
  const holidays = useLeaveStore((s) => s.holidays)
  const addHoliday = useLeaveStore((s) => s.addHoliday)
  const fetchHolidays = useLeaveStore((s) => s.fetchHolidays)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [open, setOpen] = useState(false)
  const [eventTitle, setEventTitle] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [eventDesc, setEventDesc] = useState('')

  const events: EventInput[] = useMemo(
    () =>
      holidays.map((h) => ({
        id: h.id,
        title: h.title,
        start: h.date,
        allDay: true,
        backgroundColor: '#16a34a',
        borderColor: '#16a34a',
      })),
    [holidays],
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-xl border border-border bg-surface/60 p-4 md:grid-cols-3 md:items-end">
        <Input label="Holiday title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button
          onClick={async () => {
            if (!title || !date) {
              toast.error('Add title and date')
              return
            }
            await addHoliday({ title, date })
            setTitle('')
            setDate('')
            toast.success('Holiday added')
            await fetchHolidays()
          }}
        >
          Add holiday
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
          height="auto"
          events={events}
          dateClick={() => setOpen(true)}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {holidays.map((h) => (
          <div key={h.id} className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <p className="font-medium text-ink">{h.title}</p>
            <p className="text-sm text-muted">{formatDate(h.date)}</p>
          </div>
        ))}
      </div>

      <Modal isOpen={open} title="Add calendar event" onClose={() => setOpen(false)}>
        <div className="grid gap-3">
          <Input label="Event name" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} />
          <Input label="Date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          <Input label="Time" type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
          <label className="block text-sm font-medium text-ink">
            Description
            <textarea
              className="mt-1 min-h-[90px] w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={eventDesc}
              onChange={(e) => setEventDesc(e.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.success('Event saved (demo)')
                setOpen(false)
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
