import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { CombinedChecklistSection } from './CombinedChecklistSection'
import type { CellChecklistItem, CellStage, CellType } from '@/services/projectMgmtService'
import { CELL_STAGES } from './stageConstants'
import { cn } from '@/utils/cn'

interface CellReviewModalProps {
  isOpen: boolean
  onClose: () => void
  cellName: string
  currentStage: CellStage
  cellId: string
  cellType: CellType
  checklistItems: CellChecklistItem[]
  onRefresh: () => void
  onSubmit: (payload: {
    action: 'approve' | 'reject'
    rejectTo?: 'floor_plan' | 'routing'
    feedback?: string
  }) => Promise<void>
  loading?: boolean
}

export function CellReviewModal({
  isOpen,
  onClose,
  cellName,
  currentStage,
  cellId,
  cellType,
  checklistItems,
  onRefresh,
  onSubmit,
  loading = false,
}: CellReviewModalProps) {
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve')
  const [rejectTo, setRejectTo] = useState<'floor_plan' | 'routing'>('floor_plan')
  const [feedback, setFeedback] = useState('')
  const [confirmDrcReject, setConfirmDrcReject] = useState(false)

  const isLvs = currentStage === 'lvs'
  const isDrc1 = currentStage === 'drc_1'
  const requiredItems = checklistItems.filter((i) => i.required)
  const requiredDone = requiredItems.filter((i) => i.checked).length
  const canApproveLvs = !isLvs || requiredItems.length === 0 || requiredDone === requiredItems.length

  const handleSubmit = async () => {
    if (reviewAction === 'reject' && isDrc1 && !confirmDrcReject) {
      setConfirmDrcReject(true)
      return
    }
    await onSubmit({
      action: reviewAction,
      rejectTo: reviewAction === 'reject' ? rejectTo : undefined,
      feedback: feedback.trim() || undefined,
    })
    setConfirmDrcReject(false)
    setFeedback('')
    setReviewAction('approve')
    setRejectTo('floor_plan')
  }

  const handleClose = () => {
    setConfirmDrcReject(false)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} title={`Review — ${cellName}`} onClose={handleClose} size="lg">
      <div className="space-y-4">
        <div className="rounded-xl bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-900">
                {cellName} at {CELL_STAGES.find((s) => s.key === currentStage)?.label}
              </p>
              <p className="mt-1 text-xs text-amber-700">
                {isDrc1
                  ? 'Approve to advance to Routing, or reject to send back to Floor Plan.'
                  : 'Complete all custom checklist items, then approve to mark cell as completed.'}
              </p>
            </div>
          </div>
        </div>

        {(isDrc1 || isLvs) && (
          <CombinedChecklistSection
            cellId={cellId}
            cellType={cellType}
            customItems={checklistItems}
            customToggleable={isLvs}
            onRefresh={onRefresh}
          />
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setReviewAction('approve')
              setConfirmDrcReject(false)
            }}
            className={cn(
              'flex-1 rounded-xl border px-4 py-3 text-sm font-semibold',
              reviewAction === 'approve'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-border bg-white text-slate-600'
            )}
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => setReviewAction('reject')}
            className={cn(
              'flex-1 rounded-xl border px-4 py-3 text-sm font-semibold',
              reviewAction === 'reject'
                ? 'border-red-300 bg-red-50 text-red-700'
                : 'border-border bg-white text-slate-600'
            )}
          >
            Reject
          </button>
        </div>

        {reviewAction === 'reject' && isDrc1 && confirmDrcReject && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-800">Move back to Floor Plan?</p>
            <p className="mt-1 text-xs text-red-600">
              The cell will return to stage 1 and employees must rework from Floor Plan.
            </p>
          </div>
        )}

        {reviewAction === 'reject' && isLvs && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Move back to:</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRejectTo('floor_plan')}
                className={cn(
                  'rounded-xl border px-4 py-2 text-sm font-medium',
                  rejectTo === 'floor_plan'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-white'
                )}
              >
                Floor Plan
              </button>
              <button
                type="button"
                onClick={() => setRejectTo('routing')}
                className={cn(
                  'rounded-xl border px-4 py-2 text-sm font-medium',
                  rejectTo === 'routing'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-white'
                )}
              >
                Routing
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">
            Message to assigned employees
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Review feedback visible to all assigned employees..."
            rows={3}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant={reviewAction === 'approve' ? 'primary' : 'danger'}
            onClick={handleSubmit}
            loading={loading}
            disabled={reviewAction === 'approve' && isLvs && !canApproveLvs}
          >
            {reviewAction === 'reject' && isDrc1 && !confirmDrcReject
              ? 'Continue'
              : reviewAction === 'approve'
                ? 'Approve'
                : isDrc1
                  ? 'Confirm Reject'
                  : 'Reject'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
