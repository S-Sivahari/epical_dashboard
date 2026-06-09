import { useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Circle, Loader2, MessageSquarePlus } from 'lucide-react'
import { Button } from '@components/employee/ui/button'
import { Badge } from '@components/employee/ui/badge'
import {
  LAYOUT_STAGE_LABELS,
  LAYOUT_STAGES,
  VIEW_PROGRESS_LABELS,
  normalizeWorkflow,
  getAdvancePayload,
  layoutStageButtonLabel,
} from '@/utils/cellWorkflowUi'
import { cn } from '@pages/employee/lib/utils'
import './employeeProjectWorkflow.css'

const SIMPLE_VIEWS = [
  { id: 'style', label: 'Style' },
  { id: 'symbol', label: 'Symbol' },
]

const PROGRESS_STEPS = ['not_started', 'in_progress', 'completed']

function progressVariant(status) {
  if (status === 'completed') return 'success'
  if (status === 'in_progress') return 'warning'
  return 'secondary'
}

function ProgressRail({ current, onSelect, disabled = false }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PROGRESS_STEPS.map((step, index) => {
        const isActive = current === step
        const isPast = PROGRESS_STEPS.indexOf(current) > index
        return (
          <button
            key={step}
            type="button"
            disabled={disabled}
            onClick={() => onSelect?.(step)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition',
              isActive && 'border-emerald-500 bg-emerald-50 text-emerald-900',
              isPast && !isActive && 'border-emerald-200 bg-emerald-50/60 text-emerald-800',
              !isActive && !isPast && 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            {isPast || isActive ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            )}
            <span className="font-semibold">{VIEW_PROGRESS_LABELS[step]}</span>
          </button>
        )
      })}
    </div>
  )
}

function LayoutPipeline({ workflow }) {
  const currentIndex = LAYOUT_STAGES.indexOf(workflow.layout.stage)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {LAYOUT_STAGES.map((stage, index) => {
          const isCurrent = workflow.layout.stage === stage
          const isPast = currentIndex > index
          const isReview = stage === 'drc_r1' || stage === 'lvs_r2'
          return (
            <div key={stage} className="flex items-center gap-1.5">
              <div
                className={cn(
                  'rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold',
                  isCurrent && 'border-emerald-500 bg-emerald-50 text-emerald-900',
                  isPast && !isCurrent && 'border-emerald-200 bg-emerald-50/50 text-emerald-800',
                  !isCurrent && !isPast && 'border-slate-200 bg-white text-slate-500',
                )}
              >
                {LAYOUT_STAGE_LABELS[stage]}
                {isReview ? ' · Review' : ''}
              </div>
              {index < LAYOUT_STAGES.length - 1 ? (
                <ArrowRight className="h-3.5 w-3.5 text-slate-300" aria-hidden />
              ) : null}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>Current stage:</span>
        <Badge variant={progressVariant(workflow.layout.status)}>{VIEW_PROGRESS_LABELS[workflow.layout.status]}</Badge>
        {workflow.layout.pendingReview ? (
          <Badge variant="warning">Awaiting {workflow.layout.pendingReview.toUpperCase()} review</Badge>
        ) : null}
      </div>
    </div>
  )
}

export function CellWorkflowPanel({
  workflow: workflowProp,
  reviews: reviewsProp,
  saving,
  onUpdateSimpleView,
  onUpdateLayoutStatus,
  onAdvanceLayout,
  onRequestReview,
}) {
  const workflow = normalizeWorkflow(workflowProp)
  const reviews = Array.isArray(reviewsProp) ? reviewsProp : []
  const [activeView, setActiveView] = useState('style')
  const [reviewComment, setReviewComment] = useState('')

  const layoutAction = useMemo(() => getAdvancePayload({ viewWorkflow: workflow }, 'layout'), [workflow])
  const layoutAwaitingReview = Boolean(workflow.layout.pendingReview)

  const openReviews = reviews.filter((r) => r.status === 'open')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[...SIMPLE_VIEWS, { id: 'layout', label: 'Layout' }].map((view) => (
          <button
            key={view.id}
            type="button"
            onClick={() => setActiveView(view.id)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
              activeView === view.id
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            )}
          >
            {view.label}
          </button>
        ))}
      </div>

      {(activeView === 'style' || activeView === 'symbol') && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground capitalize">{activeView} workflow</h3>
            <Badge variant={progressVariant(workflow[activeView].status)}>
              {VIEW_PROGRESS_LABELS[workflow[activeView].status]}
            </Badge>
          </div>
          <ProgressRail
            current={workflow[activeView].status}
            disabled={saving}
            onSelect={(status) => void onUpdateSimpleView(activeView, status)}
          />
        </div>
      )}

      {activeView === 'layout' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Layout pipeline</h3>
            <LayoutPipeline workflow={workflow} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Current: {LAYOUT_STAGE_LABELS[workflow.layout.stage]}
              </h3>
              <Badge variant={progressVariant(workflow.layout.status)}>
                {VIEW_PROGRESS_LABELS[workflow.layout.status]}
              </Badge>
            </div>
            <p className="mb-3 text-xs text-muted">
              Pipeline order: Floor Plan → DRC (R1) → Routing → DRC → LVS (R2). Stages advance only in this sequence.
            </p>
            <ProgressRail current={workflow.layout.status} disabled />

            <div className="mt-4 flex flex-wrap gap-2">
              {layoutAwaitingReview ? (
                <p className="text-xs font-semibold text-amber-700">
                  Awaiting {workflow.layout.pendingReview.toUpperCase()} admin review before continuing.
                </p>
              ) : layoutAction?.type === 'review' ? (
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Optional note for reviewer…"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={saving}
                    onClick={() => void onRequestReview(reviewComment).then(() => setReviewComment(''))}
                  >
                    <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" />
                    Request review
                  </Button>
                </div>
              ) : layoutAction ? (
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    if (layoutAction.action === 'advance_stage') void onAdvanceLayout()
                    else if (layoutAction.view && layoutAction.status) {
                      void onUpdateLayoutStatus(layoutAction.status)
                    }
                  }}
                >
                  {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="mr-1.5 h-3.5 w-3.5" />}
                  {layoutStageButtonLabel({ viewWorkflow: workflow })}
                </Button>
              ) : (
                <p className="text-xs font-semibold text-emerald-700">Layout workflow complete.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {openReviews.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <h3 className="mb-2 text-sm font-semibold text-amber-900">Open review requests</h3>
          <ul className="space-y-2">
            {openReviews.map((review) => (
              <li key={review.id} className="rounded-lg border border-amber-100 bg-white px-3 py-2 text-xs">
                <span className="font-semibold text-foreground">
                  {review.reviewPoint?.toUpperCase() || 'Review'}
                </span>
                <span className="text-muted"> · {review.stageAtRequest}</span>
                <p className="mt-1 text-muted">{review.messages?.[0]?.body}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {reviews.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Review history</h3>
          <ul className="space-y-2">
            {reviews.slice(0, 5).map((review) => (
              <li key={review.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{review.reviewPoint?.toUpperCase() || 'Review'}</span>
                  <Badge variant={review.outcome === 'approved' ? 'success' : review.outcome === 'rejected' ? 'danger' : 'secondary'}>
                    {review.outcome || review.status}
                  </Badge>
                  {review.returnToStage ? (
                    <span className="text-muted">Returned to {LAYOUT_STAGE_LABELS[review.returnToStage]}</span>
                  ) : null}
                </div>
                {review.messages?.[0] ? <p className="mt-1 text-muted">{review.messages[0].body}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
