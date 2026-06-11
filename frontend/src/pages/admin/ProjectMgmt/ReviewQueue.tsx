import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Spinner } from '@components/ui/Spinner'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Eye, MessageSquare, RefreshCw } from 'lucide-react'
import { ROUTES } from '@constants/routes'
import {
  fetchCellsForReview,
  fetchCellDetail,
  reviewCell,
  type CellForReview,
  type CellDetail,
  type CellStage,
} from '@/services/projectMgmtService'
import { CellReviewModal } from '@/components/projectMgmt/CellReviewModal'
import { cn } from '@/utils/cn'

const STAGE_LABELS: Record<CellStage, string> = {
  floor_plan: 'Floor Plan',
  drc_1: 'DRC',
  routing: 'Routing',
  drc_2: 'DRC',
  lvs: 'LVS',
}

const TYPE_COLORS: Record<string, string> = {
  Block: 'bg-violet-50 text-violet-700 border-violet-200',
  IO: 'bg-amber-50 text-amber-700 border-amber-200',
  ESD: 'bg-rose-50 text-rose-700 border-rose-200',
  TOP: 'bg-cyan-50 text-cyan-700 border-cyan-200',
}

export function ReviewQueue() {
  const navigate = useNavigate()
  const [cells, setCells] = useState<CellForReview[]>([])
  const [loading, setLoading] = useState(true)
  const [showReview, setShowReview] = useState(false)
  const [reviewCellData, setReviewCellData] = useState<CellDetail | null>(null)
  const [reviewing, setReviewing] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchCellsForReview()
      setCells(data)
    } catch {
      toast.error('Failed to load review queue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const openReview = async (cell: CellForReview) => {
    try {
      const detail = await fetchCellDetail(cell.id)
      setReviewCellData(detail)
      setShowReview(true)
    } catch {
      toast.error('Failed to load cell details')
    }
  }

  const handleReview = async (payload: {
    action: 'approve' | 'reject'
    rejectTo?: 'floor_plan' | 'routing'
    feedback?: string
  }) => {
    if (!reviewCellData) return
    try {
      setReviewing(true)
      await reviewCell(reviewCellData.id, payload)
      toast.success(payload.action === 'approve' ? 'Approved' : 'Rejected')
      setShowReview(false)
      setReviewCellData(null)
      void loadData()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Review failed')
    } finally {
      setReviewing(false)
    }
  }

  const refreshReviewCell = async () => {
    if (!reviewCellData) return
    const detail = await fetchCellDetail(reviewCellData.id)
    setReviewCellData(detail)
  }

  return (
    <PageWrapper scrollable>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Review Queue</h1>
          <p className="mt-1 text-sm text-muted">1st DRC and LVS gates awaiting your decision</p>
        </div>
        <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={loadData}>
          Refresh
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      )}

      {!loading && cells.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-300" />
          <p className="font-semibold text-muted">All clear — no cells pending review</p>
        </div>
      )}

      {!loading && cells.length > 0 && (
        <div className="space-y-3">
          {cells.map((cell) => (
            <div
              key={cell.id}
              className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/80 to-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-base font-bold text-ink">{cell.name}</span>
                  <span className={cn('rounded-md border px-2 py-0.5 text-[11px] font-semibold', TYPE_COLORS[cell.type])}>
                    {cell.type}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    <AlertTriangle className="h-3 w-3" /> {STAGE_LABELS[cell.currentStage]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {cell.projectName} / {cell.libraryName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => navigate(ROUTES.PROJECT_MGMT_CELL(cell.id))}>
                  Dashboard
                </Button>
                <Button size="sm" variant="warning" icon={<MessageSquare className="h-3.5 w-3.5" />} onClick={() => void openReview(cell)}>
                  Review
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewCellData && (
        <CellReviewModal
          isOpen={showReview}
          onClose={() => {
            setShowReview(false)
            setReviewCellData(null)
          }}
          cellName={reviewCellData.name}
          currentStage={reviewCellData.currentStage}
          cellId={reviewCellData.id}
          cellType={reviewCellData.type}
          checklistItems={reviewCellData.checklistItems || []}
          onRefresh={() => void refreshReviewCell()}
          onSubmit={handleReview}
          loading={reviewing}
        />
      )}
    </PageWrapper>
  )
}
