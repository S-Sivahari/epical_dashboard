import { useState } from 'react'
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
import { toast } from 'sonner'

const seed: EventInput[] = [
  { id: '1', title: 'Town hall', start: '2026-05-20T10:00:00', end: '2026-05-20T11:00:00', backgroundColor: '#16a34a' },
  { id: '2', title: 'Leadership sync', start: '2026-05-22T15:00:00', end: '2026-05-22T16:00:00', backgroundColor: '#3b82f6' },
]

export function CompanyCalendar() {
  const [events, setEvents] = useState<EventInput[]>(seed)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [desc, setDesc] = useState('')

  return (
    <PageWrapper>
      <PageHeader title="Company calendar" breadcrumb={<Breadcrumb items={[{ label: 'Calendar' }]} />} />
      <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
          height={720}
          events={events}
          eventClick={(info) => {
            toast.message(info.event.title, { description: info.event.startStr })
          }}
          dateClick={() => setOpen(true)}
        />
      </div>
      <Modal isOpen={open} title="Add event" onClose={() => setOpen(false)}>
        <div className="grid gap-3">
          <Input label="Event name" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
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
                const start = time ? `${date}T${time}:00` : date
                setEvents((e) => [...e, { id: String(Date.now()), title, start, backgroundColor: '#16a34a' }])
                toast.success('Event added')
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
