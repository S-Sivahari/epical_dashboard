import { useState, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { format, addDays } from 'date-fns'
import { Badge } from '@components/ui/Badge'
import { Modal } from '@components/ui/Modal'
import { useLeaves } from '@hooks/useLeaves'
import { formatDate } from '@/utils/formatDate'

export function TeamLeaveCalendar() {
  const { leaves, loading } = useLeaves()
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Only consider approved leaves for the calendar
  const approvedLeaves = useMemo(() => {
    return leaves.filter((l) => l.status === 'Approved')
  }, [leaves])

  // Map dates to the count of employees on leave to highlight overlaps
  const dateCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    approvedLeaves.forEach((l) => {
      const start = new Date(l.from)
      const end = new Date(l.to)
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = format(d, 'yyyy-MM-dd')
        map[dateStr] = (map[dateStr] || 0) + 1
      }
    })
    return map
  }, [approvedLeaves])

  // Convert leaves to FullCalendar events
  const events = useMemo(() => {
    return approvedLeaves.map((l) => {
      // FullCalendar 'end' is exclusive for all-day events, so we add 1 day
      const endDate = addDays(new Date(l.to), 1)
      return {
        id: l.id,
        title: l.employeeName,
        start: l.from,
        end: format(endDate, 'yyyy-MM-dd'),
        allDay: true,
        extendedProps: { leave: l },
        backgroundColor: '#f1f5f9', // subtle slate background
        borderColor: '#e2e8f0',
        textColor: '#0f172a',
      }
    })
  }, [approvedLeaves])

  const handleDateClick = (dateStr: string) => {
    setSelectedDateStr(dateStr)
    setIsModalOpen(true)
  }

  // Find all leaves overlapping with the clicked date
  const leavesOnSelectedDate = useMemo(() => {
    if (!selectedDateStr) return []
    return approvedLeaves.filter((l) => {
      return selectedDateStr >= l.from && selectedDateStr <= l.to
    })
  }, [selectedDateStr, approvedLeaves])

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface/40">
          <span className="text-sm text-muted">Loading calendar...</span>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth',
            }}
            events={events}
            height="auto"
            dayCellClassNames={(arg) => {
              const dateStr = format(arg.date, 'yyyy-MM-dd')
              if (dateCountMap[dateStr] > 1) {
                return 'bg-red-50' // Highlight overlapping days
              }
              return ''
            }}
            dateClick={(arg) => handleDateClick(arg.dateStr)}
            eventClick={(arg) => {
              // If an event is clicked, just open the date it was clicked on
              if (arg.event.start) {
                handleDateClick(format(arg.event.start, 'yyyy-MM-dd'))
              }
            }}
            eventClassNames="cursor-pointer rounded border transition-colors hover:border-primary/30"
          />
        </div>
      )}

      {/* Modal showing leaves on a specific date */}
      <Modal
        isOpen={isModalOpen}
        title={`Leaves on ${selectedDateStr ? formatDate(selectedDateStr) : ''}`}
        onClose={() => setIsModalOpen(false)}
        size="md"
      >
        <div className="space-y-4">
          {leavesOnSelectedDate.length === 0 ? (
            <p className="text-sm text-muted">No employees are on leave on this date.</p>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border">
              {leavesOnSelectedDate.map((l) => (
                <div key={l.id} className="flex items-center justify-between p-4 hover:bg-surface/50">
                  <div>
                    <p className="font-medium text-ink">{l.employeeName}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {l.type} • {l.leaveDuration === 'Half Day' ? `Half Day (${l.halfDaySession})` : 'Full Day'}
                    </p>
                  </div>
                  <Badge variant="success">Approved</Badge>
                </div>
              ))}
            </div>
          )}
          {leavesOnSelectedDate.length > 1 && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              <span className="font-semibold">Attention:</span> Multiple employees are on leave on this date.
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
