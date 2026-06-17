import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { formatDateTime } from '@/utils/formatDate'
import type { Ticket, TicketStatus } from '@/types'
import { getNextStatus, getPrevStatus, openTicketAttachment } from '@services/ticketService'
import { ArrowLeft, ArrowRight, MessageSquare, Paperclip, Trash2 } from 'lucide-react'

export function priorityVariant(priority: string): 'neutral' | 'warning' | 'danger' | 'info' {
  if (priority === 'Critical' || priority === 'High') return 'danger'
  if (priority === 'Medium') return 'warning'
  if (priority === 'Low') return 'info'
  return 'neutral'
}

export function statusVariant(status: TicketStatus): 'success' | 'info' | 'warning' {
  if (status === 'Completed') return 'success'
  if (status === 'In Progress') return 'info'
  return 'warning'
}

export function TicketDetailModal({
  ticket,
  isOpen,
  onClose,
  onUpdateStatus,
  onAddComment,
  onDelete,
  deleting,
  advancing,
}: {
  ticket: Ticket | null
  isOpen: boolean
  onClose: () => void
  onUpdateStatus: (id: string, next: TicketStatus, remark?: string) => Promise<void>
  onAddComment: (id: string, text: string) => Promise<void>
  onDelete?: () => void
  deleting?: boolean
  advancing?: boolean
}) {
  const [statusRemark, setStatusRemark] = useState('')
  const [comment, setComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  if (!ticket) return null

  const nextStatus = getNextStatus(ticket.status)
  const prevStatus = getPrevStatus(ticket.status)

  const changeStatus = async (target: TicketStatus) => {
    try {
      await onUpdateStatus(ticket.id, target, statusRemark.trim() || undefined)
      setStatusRemark('')
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(message || 'Failed to update status')
    }
  }

  const handleComment = async () => {
    if (!comment.trim()) return
    setSubmittingComment(true)
    try {
      await onAddComment(ticket.id, comment.trim())
      setComment('')
    } catch {
      toast.error('Failed to add remark')
    } finally {
      setSubmittingComment(false)
    }
  }

  return (
    <Modal isOpen={isOpen} title={`Ticket ${ticket.id}`} onClose={onClose} size="lg">
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase text-muted">Employee</p>
            <p className="font-medium text-ink">{ticket.employeeName}</p>
            <p className="text-muted">{ticket.employeeId}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted">Created</p>
            <p className="text-ink">{formatDateTime(ticket.createdAt)}</p>
          </div>
        </div>

        {ticket.projectName ? (
          <div>
            <p className="text-xs font-medium uppercase text-muted">Project</p>
            <p className="text-ink">{ticket.projectName}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Badge variant={priorityVariant(ticket.priority)}>{ticket.priority}</Badge>
          <Badge variant={statusVariant(ticket.status)}>{ticket.status}</Badge>
        </div>

        <div>
          <p className="text-xs font-medium uppercase text-muted">Issue Title</p>
          <p className="font-medium text-ink">{ticket.title}</p>
        </div>

        <div className="rounded-lg border border-border bg-surface/40 p-3">
          <p className="mb-1 text-xs font-medium uppercase text-muted">Employee Description</p>
          <p className="whitespace-pre-wrap text-ink">{ticket.description || 'No description provided.'}</p>
          <p className="mt-2 text-xs text-muted">Original submission — read only</p>
        </div>

        {(ticket.hasAttachment || ticket.attachment) && (
          <button
            type="button"
            onClick={() =>
              openTicketAttachment(ticket.id, ticket.attachment?.filename).catch(() =>
                toast.error('Failed to open attachment'),
              )
            }
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <Paperclip className="h-4 w-4" />
            {ticket.attachment?.filename || 'View attachment'}
          </button>
        )}

        {ticket.comments && ticket.comments.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase text-muted">
              <MessageSquare className="h-3.5 w-3.5" /> Admin Remarks
            </p>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
              {ticket.comments.map((c) => (
                <div key={c.id} className="rounded-md bg-surface/60 px-3 py-2">
                  <p className="text-xs text-muted">
                    {c.authorName} · {formatDateTime(c.createdAt)}
                  </p>
                  <p className="text-ink">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2 border-t border-border pt-3">
          <label className="text-xs font-medium uppercase text-muted">Add Remark</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Internal note or update for the employee..."
            className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={!comment.trim() || submittingComment}
            onClick={() => void handleComment()}
          >
            Save Remark
          </Button>
        </div>

        {(prevStatus || nextStatus) && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-medium uppercase text-muted">Change status</p>
            <textarea
              value={statusRemark}
              onChange={(e) => setStatusRemark(e.target.value)}
              rows={2}
              placeholder="Optional note stored with this status change..."
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(ticket.status)}>{ticket.status}</Badge>
              {prevStatus ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={advancing}
                  onClick={() => void changeStatus(prevStatus)}
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                  Move to {prevStatus}
                </Button>
              ) : null}
              {nextStatus ? (
                <Button
                  size="sm"
                  variant="primary"
                  disabled={advancing}
                  className={ticket.status === 'In Progress' ? 'bg-emerald-700 hover:bg-emerald-800' : undefined}
                  onClick={() => void changeStatus(nextStatus)}
                >
                  {nextStatus === 'Completed' ? 'Mark as completed' : `Move to ${nextStatus}`}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Button>
              ) : null}
            </div>
          </div>
        )}

        {onDelete ? (
          <div className="admin-tickets-modal-section border-t border-red-200/60 pt-4">
            <p className="admin-tickets-modal-label text-red-800">Danger zone</p>
            <p className="mb-3 text-xs text-slate-600">
              Permanently remove this ticket and its comments from the system.
            </p>
            <Button
              size="sm"
              variant="danger"
              type="button"
              className="admin-tickets-danger-btn"
              disabled={deleting || advancing}
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete ticket
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
