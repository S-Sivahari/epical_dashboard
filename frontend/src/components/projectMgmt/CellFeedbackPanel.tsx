import { useState } from 'react'
import { Loader2, MessageSquare, Shield, User } from 'lucide-react'
import { toast } from 'sonner'
import { addCellFeedback, type CellFeedback } from '@/services/projectMgmtService'
import { formatDate } from '@/utils/formatDate'
import { cn } from '@/utils/cn'

interface CellFeedbackPanelProps {
  feedbacks: CellFeedback[]
  cellId: string
  onRefresh: () => void
  readOnly?: boolean
}

export function CellFeedbackPanel({ feedbacks, cellId, onRefresh, readOnly = false }: CellFeedbackPanelProps) {
  const [newMsg, setNewMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!newMsg.trim()) return
    try {
      setSubmitting(true)
      await addCellFeedback(cellId, newMsg.trim())
      setNewMsg('')
      toast.success('Feedback sent')
      onRefresh()
    } catch {
      toast.error('Failed to add feedback')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-ink">Feedback & Review Notes</h3>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          {feedbacks.length}
        </span>
      </div>

      {!readOnly && (
        <div className="flex gap-2">
          <textarea
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            placeholder="Add feedback or notes for the team..."
            rows={2}
            className="flex-1 resize-none rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !newMsg.trim()}
            className="self-end rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
          </button>
        </div>
      )}

      {feedbacks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-slate-50/50 py-8 text-center">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 text-slate-200" />
          <p className="text-xs text-muted">No feedback yet</p>
        </div>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {feedbacks.map((fb, i) => (
            <div
              key={i}
              className={cn(
                'rounded-xl border px-4 py-3',
                fb.authorRole === 'Admin'
                  ? 'border-primary/20 bg-gradient-to-r from-primary/5 to-transparent'
                  : 'border-border bg-white'
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full',
                    fb.authorRole === 'Admin' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {fb.authorRole === 'Admin' ? (
                    <Shield className="h-3 w-3" />
                  ) : (
                    <User className="h-3 w-3" />
                  )}
                </div>
                <span className="text-xs font-semibold text-ink">{fb.authorName}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase',
                    fb.authorRole === 'Admin' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {fb.authorRole}
                </span>
                <span className="ml-auto text-[10px] text-muted">{formatDate(fb.createdAt)}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink">{fb.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
