import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  Users,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchCellDetail,
  advanceCellStage,
  submitCellForReview,
  type CellDetail,
} from '@/services/projectMgmtService'
import { CellViewTabs } from '@/components/projectMgmt/CellViewTabs'
import { CellFeedbackPanel } from '@/components/projectMgmt/CellFeedbackPanel'
import { CombinedChecklistSection } from '@/components/projectMgmt/CombinedChecklistSection'
import {
  CELL_STAGES,
  CELL_TYPE_COLORS,
  STAGE_STATUS_LABELS,
  STAGE_STATUS_STYLES,
  getStageIndex,
} from '@/components/projectMgmt/stageConstants'
import { formatDate } from '@/utils/formatDate'
import { cn } from '@/utils/cn'

export function EmployeeCellDetail() {
  const { cellId } = useParams<{ cellId: string }>()
  const navigate = useNavigate()
  const [cell, setCell] = useState<CellDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const loadCell = useCallback(async () => {
    if (!cellId) return
    try {
      setLoading(true)
      const data = await fetchCellDetail(cellId)
      setCell(data)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Failed to load cell')
    } finally {
      setLoading(false)
    }
  }, [cellId])

  useEffect(() => {
    void loadCell()
  }, [loadCell])

  const handleAdvance = async () => {
    if (!cellId) return
    try {
      setActionLoading(true)
      await advanceCellStage(cellId)
      toast.success('Advanced to next stage')
      void loadCell()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Failed to advance stage')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSubmitForReview = async () => {
    if (!cellId) return
    try {
      setActionLoading(true)
      await submitCellForReview(cellId)
      toast.success('Submitted for admin review')
      void loadCell()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Failed to submit for review')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!cell) {
    return <div className="py-24 text-center text-muted">Cell not found or access denied</div>
  }

  const stageIdx = getStageIndex(cell.currentStage)
  const stageInfo = CELL_STAGES[stageIdx]
  const isReviewStage = stageInfo?.isReview ?? false
  const isForReview = cell.stageStatus === 'for_review'
  const isFinalStage = cell.currentStage === 'lvs' && cell.stageStatus === 'approved'
  const canAdvance = cell.stageStatus === 'in_progress' && !isReviewStage && !isFinalStage
  const canSubmitForReview = cell.stageStatus === 'in_progress' && isReviewStage

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <button
        type="button"
        onClick={() => navigate('/employee/cells')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Cells
      </button>

      <div className="rounded-2xl border border-border bg-gradient-to-br from-white via-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{cell.name}</h1>
              <span className={cn('rounded-lg border px-2.5 py-0.5 text-xs font-bold', CELL_TYPE_COLORS[cell.type])}>
                {cell.type}
              </span>
              <span
                className={cn(
                  'rounded-lg border px-2.5 py-0.5 text-[10px] font-bold uppercase',
                  STAGE_STATUS_STYLES[cell.stageStatus]
                )}
              >
                {STAGE_STATUS_LABELS[cell.stageStatus]}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {cell.projectName} · {cell.libraryName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
          {canAdvance && (
              <button
                type="button"
                onClick={handleAdvance}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                Advance Stage
              </button>
            )}

            {canSubmitForReview && (
              <button
                type="button"
                onClick={handleSubmitForReview}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                Submit for Review
              </button>
            )}

            {isForReview && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                Awaiting admin review
              </div>
            )}

            {isFinalStage && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Cell completed
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <Users className="h-4 w-4" />
          Team
        </h3>
        {cell.assignedTo.length === 0 ? (
          <p className="text-xs text-muted">No employees assigned</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {cell.assignedTo.map((a, i) => (
              <span
                key={i}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
              >
                {a.employeeName}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <CombinedChecklistSection
          cellId={cell.id}
          cellType={cell.type}
          customItems={cell.checklistItems || []}
          onRefresh={loadCell}
        />
        {isForReview && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Waiting for admin review — you cannot advance until approved.
          </p>
        )}
      </div>

      <CellViewTabs
        cellId={cell.id}
        views={cell.views}
        currentStage={cell.currentStage}
        stageStatus={cell.stageStatus}
        canUpload
        onRefresh={loadCell}
      />

      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <CellFeedbackPanel feedbacks={cell.feedbacks} cellId={cell.id} onRefresh={loadCell} />
      </div>

      {cell.history.length > 0 && (
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-ink">Activity Timeline</h3>
          <div className="relative space-y-0 pl-4">
            <div className="absolute bottom-2 left-[7px] top-2 w-0.5 bg-slate-200" />
            {cell.history.map((h) => (
              <div key={h.id} className="relative pb-4 pl-6 last:pb-0">
                <div className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-primary shadow-sm" />
                <p className="text-sm text-ink">
                  <span className="font-semibold">{h.changedByName}</span> moved{' '}
                  <span className="font-medium">
                    {CELL_STAGES.find((s) => s.key === h.fromStage)?.label || h.fromStage}
                  </span>{' '}
                  →{' '}
                  <span className="font-medium">
                    {CELL_STAGES.find((s) => s.key === h.toStage)?.label}
                  </span>
                </p>
                {h.reason && <p className="mt-0.5 text-xs text-muted">{h.reason}</p>}
                <p className="mt-0.5 text-[10px] text-muted">{formatDate(h.changedAt)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
