import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  FolderKanban,
  Loader2,
  MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchMyAssignedCells,
  advanceCellStage,
  submitCellForReview,
  type MyCellSummary,
  type CellStageStatus,
} from '@/services/projectMgmtService'
import { StagePipeline } from '@/components/projectMgmt/StagePipeline'
import {
  CELL_STAGES,
  CELL_TYPE_COLORS,
  STAGE_STATUS_LABELS,
  STAGE_STATUS_STYLES,
  getStageIndex,
} from '@/components/projectMgmt/stageConstants'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/utils/cn'

type FilterKey = 'all' | CellStageStatus

function CellCard({ cell, onAction }: { cell: MyCellSummary; onAction: () => void }) {
  const navigate = useNavigate()
  const [actionLoading, setActionLoading] = useState(false)
  const stageIdx = getStageIndex(cell.currentStage)
  const stageInfo = CELL_STAGES[stageIdx]
  const isReviewStage = stageInfo?.isReview ?? false
  const isForReview = cell.stageStatus === 'for_review'
  const isFinalStage = cell.currentStage === 'lvs' && cell.stageStatus === 'approved'
  const canAdvance = cell.stageStatus === 'in_progress' && !isReviewStage && !isFinalStage
  const canSubmitForReview = cell.stageStatus === 'in_progress' && isReviewStage

  const handleAdvance = async () => {
    try {
      setActionLoading(true)
      await advanceCellStage(cell.id)
      toast.success('Advanced to next stage')
      onAction()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Failed to advance stage')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSubmitForReview = async () => {
    try {
      setActionLoading(true)
      await submitCellForReview(cell.id)
      toast.success('Submitted for admin review')
      onAction()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Failed to submit for review')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
      <div className="border-b border-border bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(ROUTES.EMPLOYEE_CELL(cell.id))}
                className="truncate text-left font-display text-lg font-bold text-ink transition-colors hover:text-primary"
              >
                {cell.name}
              </button>
              <span
                className={cn(
                  'inline-flex rounded-lg border px-2 py-0.5 text-[11px] font-bold',
                  CELL_TYPE_COLORS[cell.type]
                )}
              >
                {cell.type}
              </span>
              <span
                className={cn(
                  'inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                  STAGE_STATUS_STYLES[cell.stageStatus]
                )}
              >
                {STAGE_STATUS_LABELS[cell.stageStatus]}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              {cell.projectName} · {cell.libraryName}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {canAdvance && (
              <button
                type="button"
                onClick={handleAdvance}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
                Advance
              </button>
            )}

            {canSubmitForReview && (
              <button
                type="button"
                onClick={handleSubmitForReview}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                Submit Review
              </button>
            )}

            {isForReview && (
              <span className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                <Eye className="h-3.5 w-3.5" /> Awaiting Admin
              </span>
            )}

            {isFinalStage && (
              <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Completed
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 py-4">
        <StagePipeline currentStage={cell.currentStage} stageStatus={cell.stageStatus} compact />
      </div>

      <div className="flex items-center justify-between border-t border-border bg-slate-50/50 px-5 py-3">
        <div className="flex items-center gap-3 text-xs text-muted">
          {cell.feedbacks.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {cell.feedbacks.length} feedback
            </span>
          )}
          <span>
            Stage {stageIdx + 1}/5 — {stageInfo?.label}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate(ROUTES.EMPLOYEE_CELL(cell.id))}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Open workspace
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </article>
  )
}

export function MyCells() {
  const [cells, setCells] = useState<MyCellSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')

  const loadCells = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchMyAssignedCells()
      setCells(data)
    } catch {
      toast.error('Failed to load assigned cells')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCells()
  }, [loadCells])

  const stats = useMemo(() => ({
    total: cells.length,
    inProgress: cells.filter((c) => c.stageStatus === 'in_progress').length,
    forReview: cells.filter((c) => c.stageStatus === 'for_review').length,
    completed: cells.filter((c) => c.stageStatus === 'approved').length,
  }), [cells])

  const filtered = cells.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.projectName.toLowerCase().includes(search.toLowerCase()) ||
      c.libraryName.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || c.stageStatus === filter
    return matchesSearch && matchesFilter
  })

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">My Cells</h1>
            <p className="mt-1 text-sm text-muted">
              Work on assigned cells, advance through layout stages, and submit for review
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total', value: stats.total, color: 'text-ink' },
              { label: 'In Progress', value: stats.inProgress, color: 'text-blue-600' },
              { label: 'For Review', value: stats.forReview, color: 'text-amber-600' },
              { label: 'Completed', value: stats.completed, color: 'text-emerald-600' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-white px-4 py-3 text-center shadow-sm">
                <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Search cells, projects, libraries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 flex-1 rounded-xl border border-border bg-white px-4 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:max-w-sm"
        />
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted" />
          {(['all', 'in_progress', 'for_review', 'approved'] as FilterKey[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors',
                filter === f
                  ? 'bg-primary text-white'
                  : 'border border-border bg-white text-muted hover:text-ink'
              )}
            >
              {f === 'all' ? 'All' : STAGE_STATUS_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white py-24 text-center">
          <FolderKanban className="mx-auto mb-3 h-14 w-14 text-slate-200" />
          <p className="text-sm font-semibold text-muted">
            {cells.length === 0 ? 'No cells assigned to you yet' : 'No cells match your filters'}
          </p>
          <p className="mt-1 text-xs text-muted">Ask your admin to assign cells from Project Management</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((cell) => (
            <CellCard key={cell.id} cell={cell} onAction={loadCells} />
          ))}
        </div>
      )}
    </div>
  )
}
