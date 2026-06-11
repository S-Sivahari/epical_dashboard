import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock3, MessageSquare, XCircle } from 'lucide-react'
import { LAYOUT_STAGE_LABELS } from '@/utils/cellWorkflowUi'
import { cn } from '@pages/employee/lib/utils'

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
]

const REVIEW_POINT_FILTERS = [
  { id: 'all', label: 'All points' },
  { id: 'r1', label: 'R1' },
  { id: 'r2', label: 'R2' },
]

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
  const [statusFilter, setStatusFilter] = useState('all')
  const [reviewPointFilter, setReviewPointFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')

  const projectOptions = useMemo(() => {
    const byId = new Map()
    for (const review of list) {
      if (!review.projectId) continue
      if (!byId.has(review.projectId)) {
        byId.set(review.projectId, review.projectName || 'Project')
      }
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name }))
  }, [list])

  const filteredReviews = useMemo(() => {
    return list.filter((review) => {
      const status = reviewStatus(review)
      if (statusFilter !== 'all' && status !== statusFilter) return false
      if (reviewPointFilter !== 'all' && review.reviewPoint !== reviewPointFilter) return false
      if (projectFilter !== 'all' && review.projectId !== projectFilter) return false
      return true
    })
  }, [list, statusFilter, reviewPointFilter, projectFilter])

  const hasActiveFilters =
    statusFilter !== 'all' || reviewPointFilter !== 'all' || projectFilter !== 'all'

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
    <div className="emp-wf-requested-reviews">
      <div className="emp-wf-requested-reviews-toolbar">
        <div className="emp-wf-requested-reviews-filter-group">
          <span className="emp-wf-requested-reviews-filter-label">Status</span>
          <div className="emp-wf-filters" role="group" aria-label="Filter by review status">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={cn('emp-wf-pill', statusFilter === filter.id && 'is-active')}
                onClick={() => setStatusFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="emp-wf-requested-reviews-filter-group">
          <span className="emp-wf-requested-reviews-filter-label">Review</span>
          <div className="emp-wf-filters" role="group" aria-label="Filter by review point">
            {REVIEW_POINT_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={cn('emp-wf-pill', reviewPointFilter === filter.id && 'is-active')}
                onClick={() => setReviewPointFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {projectOptions.length > 1 ? (
          <div className="emp-wf-requested-reviews-filter-group emp-wf-requested-reviews-filter-group--project">
            <label className="emp-wf-requested-reviews-filter-label" htmlFor="requested-reviews-project">
              Project
            </label>
            <select
              id="requested-reviews-project"
              className="emp-wf-requested-reviews-select"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <option value="all">All projects</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {hasActiveFilters ? (
          <button
            type="button"
            className="emp-wf-requested-reviews-clear"
            onClick={() => {
              setStatusFilter('all')
              setReviewPointFilter('all')
              setProjectFilter('all')
            }}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <p className="emp-wf-requested-reviews-count">
        Showing {filteredReviews.length} of {list.length}
      </p>

      {!filteredReviews.length ? (
        <p className="emp-wf-reviews-empty">No reviews match the selected filters.</p>
      ) : (
    <ul className="emp-wf-requested-reviews-list">
      {filteredReviews.map((review) => {
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
      )}
    </div>
  )
}
