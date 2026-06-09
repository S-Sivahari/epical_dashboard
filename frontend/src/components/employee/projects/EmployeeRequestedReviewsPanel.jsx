import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock3, MessageSquare, XCircle } from 'lucide-react'
import { LAYOUT_STAGE_LABELS } from '@/utils/cellWorkflowUi'
import { cn } from '@pages/employee/lib/utils'

function stageLabel(stageKey) {
  if (!stageKey) return '—'
  return LAYOUT_STAGE_LABELS[stageKey] || String(stageKey).replace(/_/g, ' ')
}

function reviewStatus(review) {
  if (review.status === 'open') return 'pending'
  return review.outcome || 'pending'
}

function statusMeta(status) {
  switch (status) {
    case 'approved':
      return { label: 'Approved', className: 'emp-wf-review-status--approved', icon: CheckCircle2 }
    case 'rejected':
      return { label: 'Rejected', className: 'emp-wf-review-status--rejected', icon: XCircle }
    default:
      return { label: 'Pending', className: 'emp-wf-review-status--pending', icon: Clock3 }
  }
}

function formatWhen(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function EmployeeRequestedReviewsPanel({ reviews = [], loading = false }) {
  const navigate = useNavigate()
  const list = Array.isArray(reviews) ? reviews : []

  if (loading) {
    return <p className="emp-wf-status">Loading requested reviews…</p>
  }

  if (!list.length) {
    return (
      <p className="emp-wf-reviews-empty">
        No review requests yet. Request a review from a cell workflow when a stage is ready.
      </p>
    )
  }

  return (
    <ul className="emp-wf-requested-reviews-list">
      {list.map((review) => {
        const status = reviewStatus(review)
        const meta = statusMeta(status)
        const StatusIcon = meta.icon
        const primaryMessage = review.messages?.[0]
        const when = formatWhen(primaryMessage?.at || review.resolvedAt || review.createdAt)

        return (
          <li key={review.id}>
            <button
              type="button"
              className="emp-wf-requested-review-card"
              onClick={() =>
                navigate(`/employee/projects/${review.projectId}/cells/${review.cellId}`)
              }
            >
              <div className="emp-wf-requested-review-card-top">
                <div className="min-w-0 text-left">
                  <p className="emp-wf-requested-review-cell">{review.cellName || 'Cell'}</p>
                  <p className="emp-wf-requested-review-project">{review.projectName || 'Project'}</p>
                </div>
                <span className={cn('emp-wf-review-status', meta.className)}>
                  <StatusIcon className="h-3 w-3 shrink-0" aria-hidden />
                  {meta.label}
                </span>
              </div>

              <div className="emp-wf-review-card-top">
                <span className="emp-wf-review-point">
                  {(review.reviewPoint || 'review').toUpperCase()}
                </span>
                <span className="emp-wf-review-stage">
                  Stage: <strong>{stageLabel(review.stageAtRequest)}</strong>
                </span>
              </div>

              {primaryMessage?.body ? (
                <p className="emp-wf-review-message">{primaryMessage.body}</p>
              ) : null}

              <div className="emp-wf-review-meta">
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" aria-hidden />
                  {review.initiatedByName || 'You'}
                </span>
                {when ? <time>{when}</time> : null}
              </div>

              {review.status === 'open' ? (
                <p className="emp-wf-review-awaiting">Awaiting admin review</p>
              ) : review.returnToStage ? (
                <p className="emp-wf-review-return">
                  Returned to {stageLabel(review.returnToStage)}
                </p>
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
