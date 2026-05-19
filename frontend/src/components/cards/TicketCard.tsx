import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import type { Ticket, TicketPriority } from '@/types'
import { formatDateTime } from '@/utils/formatDate'

const priorityVariant: Record<TicketPriority, 'info' | 'warning' | 'danger' | 'neutral'> = {
  Low: 'info',
  Medium: 'warning',
  High: 'danger',
  Critical: 'danger',
}

export function TicketCard({
  ticket,
  onMove,
}: {
  ticket: Ticket
  onMove?: (id: string) => void
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted">
            {ticket.employeeName}{' '}
            <span className="font-mono text-[11px] text-ink">({ticket.employeeId})</span>
          </p>
          <p className="mt-1 font-medium text-ink">{ticket.title}</p>
        </div>
        <Badge variant={priorityVariant[ticket.priority]}>{ticket.priority}</Badge>
      </div>
      <p className="mt-2 text-xs text-muted">{formatDateTime(ticket.createdAt)}</p>
      {onMove ? (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => onMove(ticket.id)}>
            Move
          </Button>
        </div>
      ) : null}
    </div>
  )
}
