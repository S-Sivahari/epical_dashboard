import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Spinner } from '@components/ui/Spinner'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  Users,
} from 'lucide-react'
import {
  fetchCellDetail,
  reviewCell,
  type CellDetail,
} from '@/services/projectMgmtService'
import { CellViewTabs } from '@/components/projectMgmt/CellViewTabs'
import { CellFeedbackPanel } from '@/components/projectMgmt/CellFeedbackPanel'
import { CombinedChecklistSection } from '@/components/projectMgmt/CombinedChecklistSection'
import { CellReviewModal } from '@/components/projectMgmt/CellReviewModal'
import {
  CELL_STAGES,
  CELL_TYPE_COLORS,
  STAGE_STATUS_LABELS,
  STAGE_STATUS_STYLES,
} from '@/components/projectMgmt/stageConstants'
import { formatDate } from '@/utils/formatDate'
import { cn } from '@/utils/cn'

export function CellDashboard() {
  const { cellId } = useParams<{ cellId: string }>()
  const navigate = useNavigate()
  const [cell, setCell] = useState<CellDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showReview, setShowReview] = useState(false)
  const [reviewing, setReviewing] = useState(false)

  const loadCell = useCallback(async () => {
    if (!cellId) return
    try {
      setLoading(true)
      const data = await fetchCellDetail(cellId)
      setCell(data)
    } catch {
      toast.error('Failed to load cell')
    } finally {
      setLoading(false)
    }
  }, [cellId])

  useEffect(() => {
    void loadCell()
  }, [loadCell])

  const handleReview = async (payload: {
    action: 'approve' | 'reject'
    rejectTo?: 'floor_plan' | 'routing'
    feedback?: string
  }) => {
    if (!cellId) return
    try {
      setReviewing(true)
      await reviewCell(cellId, payload)
      toast.success(payload.action === 'approve' ? 'Approved' : 'Rejected')
      setShowReview(false)
      void loadCell()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Review failed')
    } finally {
      setReviewing(false)
    }
  }

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center py-24">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      </PageWrapper>
    )
  }

  if (!cell) {
    return (
      <PageWrapper>
        <p className="py-24 text-center text-muted">Cell not found</p>
      </PageWrapper>
    )
  }

  const isReviewStage = cell.currentStage === 'drc_1' || cell.currentStage === 'lvs'
  const isForReview = cell.stageStatus === 'for_review'
  const isFinalStage = cell.currentStage === 'lvs' && cell.stageStatus === 'approved'

  return (
    <PageWrapper scrollable>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="mb-6 rounded-2xl border border-border bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
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
            {isForReview && (
              <Button
                variant="warning"
                icon={<Eye className="h-4 w-4" />}
                onClick={() => setShowReview(true)}
              >
                Review Cell
              </Button>
            )}

            {!isForReview && isReviewStage && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <Clock className="h-4 w-4" />
                Awaiting employee submission
              </div>
            )}

            {!isReviewStage && !isFinalStage && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700">
                <Clock className="h-4 w-4" />
                Employee working on stage
              </div>
            )}

            {isFinalStage && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Cell completed
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-white p-4 shadow-sm">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
          <Users className="h-4 w-4" />
          Assigned Employees
        </h3>
        {cell.assignedTo.length === 0 ? (
          <p className="text-xs text-muted">No employees assigned</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {cell.assignedTo.map((a, i) => (
              <span key={i} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {a.employeeName}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-white p-5 shadow-sm">
        <CombinedChecklistSection
          cellId={cell.id}
          cellType={cell.type}
          customItems={cell.checklistItems || []}
          customEditable
          onRefresh={loadCell}
        />
      </div>

      <div className="mb-6">
        <CellViewTabs
          cellId={cell.id}
          views={cell.views}
          currentStage={cell.currentStage}
          stageStatus={cell.stageStatus}
          canUpload
          onRefresh={loadCell}
        />
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-white p-5 shadow-sm">
        <CellFeedbackPanel feedbacks={cell.feedbacks} cellId={cell.id} onRefresh={loadCell} />
      </div>

      {cell.history.length > 0 && (
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-ink">Activity Timeline</h3>
          <div className="space-y-3">
            {cell.history.map((h) => (
              <div key={h.id} className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">
                    <span className="font-semibold">{h.changedByName}</span> —{' '}
                    {CELL_STAGES.find((s) => s.key === h.fromStage)?.label || h.fromStage} →{' '}
                    {CELL_STAGES.find((s) => s.key === h.toStage)?.label}
                  </p>
                  {h.reason && <p className="mt-0.5 text-xs text-muted">{h.reason}</p>}
                  <p className="mt-0.5 text-[10px] text-muted">{formatDate(h.changedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <CellReviewModal
        isOpen={showReview}
        onClose={() => setShowReview(false)}
        cellName={cell.name}
        currentStage={cell.currentStage}
        cellId={cell.id}
        cellType={cell.type}
        checklistItems={cell.checklistItems || []}
        onRefresh={loadCell}
        onSubmit={handleReview}
        loading={reviewing}
      />
    </PageWrapper>
  )
}
