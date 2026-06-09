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
      return {
        label: 'Approved',
        className: 'emp-wf-review-status--approved',
        icon: CheckCircle2,
      }
    case 'rejected':
      return {
        label: 'Rejected',
        className: 'emp-wf-review-status--rejected',
        icon: XCircle,
      }
    default:
      return {
        label: 'Pending',
        className: 'emp-wf-review-status--pending',
        icon: Clock3,
      }
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

export function EmployeeCellReviewSection({ reviews = [] }) {
  const list = Array.isArray(reviews) ? reviews.slice(0, 6) : []

  return (
    <section className="emp-wf-reviews-panel" aria-label="Reviews">
      <header className="emp-wf-reviews-head">
        <div className="emp-wf-reviews-title-row">
          <MessageSquare className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
          <h2 className="emp-wf-reviews-title">Reviews</h2>
          {list.length > 0 ? (
            <span className="emp-wf-reviews-count">{list.length}</span>
          ) : null}
        </div>
        <p className="emp-wf-reviews-subtitle">Track review requests and admin outcomes</p>
      </header>

      <div className="emp-wf-reviews-body">
        {list.length === 0 ? (
          <p className="emp-wf-reviews-empty">No reviews yet. Request a review from the workflow when ready.</p>
        ) : (
          <ul className="emp-wf-reviews-list">
            {list.map((review) => {
              const status = reviewStatus(review)
              const meta = statusMeta(status)
              const StatusIcon = meta.icon
              const primaryMessage = review.messages?.[0]
              const when = formatWhen(primaryMessage?.at || review.resolvedAt)

              return (
                <li key={review.id} className="emp-wf-review-card">
                  <div className="emp-wf-review-card-top">
                    <span className="emp-wf-review-point">
                      {(review.reviewPoint || 'review').toUpperCase()}
                    </span>
                    <span className={cn('emp-wf-review-status', meta.className)}>
                      <StatusIcon className="h-3 w-3 shrink-0" aria-hidden />
                      {meta.label}
                    </span>
                  </div>

                  <p className="emp-wf-review-stage">
                    Stage: <strong>{stageLabel(review.stageAtRequest)}</strong>
                  </p>

                  {primaryMessage?.body ? (
                    <p className="emp-wf-review-message">{primaryMessage.body}</p>
                  ) : null}

                  <div className="emp-wf-review-meta">
                    {primaryMessage?.authorName ? (
                      <span>By {primaryMessage.authorName}</span>
                    ) : review.initiatedByName ? (
                      <span>By {review.initiatedByName}</span>
                    ) : null}
                    {when ? <time>{when}</time> : null}
                  </div>

                  {review.status === 'open' ? (
                    <p className="emp-wf-review-awaiting">Awaiting admin review</p>
                  ) : review.returnToStage ? (
                    <p className="emp-wf-review-return">
                      Returned to {stageLabel(review.returnToStage)}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
