import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO, isValid } from 'date-fns'
import { Calendar, ChevronRight, DollarSign, Megaphone, Palmtree } from 'lucide-react'
import { motion } from 'framer-motion'
import { GlassCard, SectionHeader } from './shared'
import { ROUTES } from '@constants/routes'

interface CalendarEvent {
  id: string
  title: string
  date: string
  type: 'leave' | 'holiday' | 'payroll' | 'event' | 'announcement'
  detail?: string
}

const typeConfig = {
  leave: { icon: Palmtree, color: '#266b1c', label: 'Leave' },
  holiday: { icon: Calendar, color: '#2f7d24', label: 'Holiday' },
  payroll: { icon: DollarSign, color: '#266b1c', label: 'Payroll' },
  event: { icon: Calendar, color: '#266b1c', label: 'Event' },
  announcement: { icon: Megaphone, color: '#266b1c', label: 'News' },
}

export function SmartCalendarHub({
  leaves,
  holidays,
}: {
  leaves: any[]
  holidays: any[]
}) {
  const events: CalendarEvent[] = useMemo(() => {
    const items: CalendarEvent[] = []

    leaves
      .filter((l) => l.status === 'Approved' || l.status === 'Pending')
      .slice(0, 6)
      .forEach((l) => {
        items.push({
          id: `leave-${l._id || l.id}`,
          title: `${l.employeeName || 'Employee'} — ${l.leaveType || 'Leave'}`,
          date: l.startDate || l.createdAt,
          type: 'leave',
          detail: l.status,
        })
      })

    holidays.slice(0, 4).forEach((h) => {
      items.push({
        id: `holiday-${h._id || h.id}`,
        title: h.title || h.name || 'Holiday',
        date: h.date,
        type: 'holiday',
      })
    })

    const now = new Date()
    items.push({
      id: 'payroll-deadline',
      title: 'Payroll processing deadline',
      date: format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd'),
      type: 'payroll',
      detail: 'End of month',
    })

    return items
      .filter((e) => {
        if (!e.date) return false
        const d = new Date(String(e.date).slice(0, 10))
        return isValid(d)
      })
      .sort((a, b) => new Date(String(a.date).slice(0, 10)).getTime() - new Date(String(b.date).slice(0, 10)).getTime())
      .slice(0, 8)
  }, [leaves, holidays])

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    events.forEach((e) => {
      const key = String(e.date).slice(0, 10)
      const list = map.get(key) || []
      list.push(e)
      map.set(key, list)
    })
    return Array.from(map.entries())
  }, [events])

  return (
    <section>
      <SectionHeader
        title="Smart Calendar"
        subtitle="Leaves, events, payroll deadlines, and announcements"
        action={
          <Link to={ROUTES.CALENDAR} className="cmd-hero-link text-sm">
            Open full calendar <ChevronRight className="inline h-3.5 w-3.5" />
          </Link>
        }
      />
      <GlassCard padding="sm" hover={false}>
        <div className="space-y-4">
          {grouped.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">No upcoming events</p>
          ) : (
            grouped.map(([dateKey, dayEvents], gi) => (
              <div key={dateKey}>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-blue-dark)]">
                  {format(parseISO(dateKey), 'EEEE, MMM d')}
                </p>
                <div className="space-y-2">
                  {dayEvents.map((event, i) => {
                    const config = typeConfig[event.type]
                    const Icon = config.icon
                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: gi * 0.05 + i * 0.03 }}
                        className="cmd-calendar-event flex cursor-grab items-center gap-3 rounded-xl px-3 py-2.5 active:cursor-grabbing"
                        draggable
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: `${config.color}14`, color: config.color }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--text-primary)]">{event.title}</p>
                          {event.detail && (
                            <p className="text-xs text-[var(--text-muted)]">{event.detail}</p>
                          )}
                        </div>
                        <span className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--text-green-deep)]" style={{ background: `${config.color}18`, border: `1px solid ${config.color}30` }}>
                          {config.label}
                        </span>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </GlassCard>
    </section>
  )
}
