import { ArrowLeft, CheckCircle2, ClipboardList } from 'lucide-react'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import type { Ticket, TicketPriority, TicketStatus } from '@/types'
import { formatDateTime } from '@/utils/formatDate'
import { cn } from '@/utils/cn'

const priorityVariant: Record<TicketPriority, 'info' | 'warning' | 'danger' | 'neutral'> = {
  Low: 'info',
  Medium: 'warning',
  High: 'danger',
  Critical: 'danger',
}

/** Solid left bar — card body stays white for contrast inside the column */
const columnAccent: Record<TicketStatus, string> = {
  Pending: 'border-l-amber-500',
  'In Progress': 'border-l-sky-600',
  Completed: 'border-l-emerald-600',
}

function forwardLabel(status: TicketStatus): string {
  if (status === 'Pending') return 'Start work'
  if (status === 'In Progress') return 'Mark as completed'
  return ''
}

function backLabel(status: TicketStatus): string {
  if (status === 'In Progress') return 'Move to pending'
  if (status === 'Completed') return 'Reopen'
  return ''
}

export function TicketCard({
  ticket,
  onMoveBack,
  onMoveForward,
  onViewDetail,
}: {
  ticket: Ticket
  onMoveBack?: (id: string) => void
  onMoveForward?: (id: string) => void
  onViewDetail?: (id: string) => void
}) {
  const initial = ticket.employeeName?.trim()?.charAt(0)?.toUpperCase() || '?'
  const showBack = onMoveBack && ticket.status !== 'Pending'
  const showForward = onMoveForward && ticket.status !== 'Completed'
  const surface = columnAccent[ticket.status]

  return (
    <article
      className={cn(
        'rounded-lg border border-border bg-white border-l-[3px] p-4',
        surface,
        'transition-shadow hover:shadow-sm',
      )}
    >
      <div
        className={cn('flex items-start gap-3', onViewDetail && 'cursor-pointer')}
        onClick={() => onViewDetail?.(ticket.id)}
        role={onViewDetail ? 'button' : undefined}
        tabIndex={onViewDetail ? 0 : undefined}
        onKeyDown={
          onViewDetail
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onViewDetail(ticket.id)
                }
              }
            : undefined
        }
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-white text-sm font-semibold text-ink"
          aria-hidden
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted">
                {ticket.employeeName}{' '}
                <span className="font-mono text-[11px] text-ink">({ticket.employeeId})</span>
              </p>
              <h3 className="mt-1 text-sm font-semibold leading-snug text-ink">{ticket.title}</h3>
            </div>
            <Badge variant={priorityVariant[ticket.priority]} className="shrink-0">
              {ticket.priority}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted">{formatDateTime(ticket.createdAt)}</p>
        </div>
      </div>

      {showBack || showForward ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
          {showBack ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 gap-1.5 border-border bg-white"
              onClick={(e) => {
                e.stopPropagation()
                onMoveBack!(ticket.id)
              }}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              {backLabel(ticket.status)}
            </Button>
          ) : null}
          {showForward ? (
            <Button
              size="sm"
              variant={ticket.status === 'In Progress' ? 'primary' : 'secondary'}
              className={cn('ml-auto h-8 gap-1.5', ticket.status === 'In Progress' && 'bg-emerald-700 hover:bg-emerald-800')}
              onClick={(e) => {
                e.stopPropagation()
                onMoveForward!(ticket.id)
              }}
            >
              {ticket.status === 'In Progress' ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  {forwardLabel(ticket.status)}
                </>
              ) : (
                <>
                  <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                  {forwardLabel(ticket.status)}
                </>
              )}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
