import { useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { calendarEvents, holidays } from '@pages/employee/data/mockData'
import { formatDate } from '@pages/employee/lib/utils'

export default function CompanyCalendar() {
  const fcEvents = useMemo(
    () => [
      ...calendarEvents.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        backgroundColor: e.type === 'holiday' ? '#f59e0b' : e.type === 'meeting' ? '#16a34a' : '#3b82f6',
        borderColor: 'transparent',
      })),
      ...holidays.map((h, i) => ({
        id: `h-${i}`,
        title: h.name,
        date: h.date,
        backgroundColor: '#f59e0b',
        borderColor: 'transparent',
      })),
    ],
    []
  )

  const upcoming = [...calendarEvents, ...holidays.map((h) => ({ ...h, title: h.name, type: 'holiday' }))]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 6)

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-xl border border-border bg-card p-4 shadow-card lg:col-span-2 [&_.fc]:font-body">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={fcEvents}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          height="auto"
          eventDisplay="block"
        />
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h3 className="font-heading text-lg font-semibold">Upcoming Events</h3>
          <ul className="mt-4 space-y-3">
            {upcoming.map((e, i) => (
              <li key={e.id ?? i} className="rounded-xl border border-border p-3 hover:bg-slate-50">
                <p className="font-medium">{e.title}</p>
                <p className="text-xs text-muted">{formatDate(e.date)}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h3 className="font-heading font-semibold">Monthly Holidays</h3>
          <ul className="mt-3 space-y-2">
            {holidays.map((h) => (
              <li key={h.date} className="flex justify-between text-sm">
                <span>{h.name}</span>
                <span className="text-muted">{formatDate(h.date)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
