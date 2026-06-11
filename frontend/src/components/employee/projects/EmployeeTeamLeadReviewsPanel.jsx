import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Loader2 } from 'lucide-react'
import { cn } from '@pages/employee/lib/utils'
import { resolveMyCellReview } from '@services/employeeProjectService'

export function EmployeeTeamLeadReviewsPanel({ projectId, reviews = [], loading = false, onResolved }) {
  const navigate = useNavigate()
  const [savingId, setSavingId] = useState(null)

  const openReviews = useMemo(() => reviews.filter((r) => r.status === 'open'), [reviews])

  const handleResolve = async (review, outcome, returnToStage = undefined) => {
    setSavingId(review.id)
    try {
      await resolveMyCellReview(projectId, review.cellId, review.id, { outcome, returnToStage })
      onResolved?.()
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return <p className="emp-wf-status">Loading pending reviews…</p>
  }

  if (!openReviews.length) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-semibold text-slate-600">No pending reviews.</p>
        <p className="mt-1 text-xs text-slate-400">Review requests from your team will appear here.</p>
      </div>
    )
  }

  return (
    <ul className="emp-wf-requested-reviews-list">
      {openReviews.map((review) => {
        const isSaving = savingId === review.id
        const isR2 = review.reviewPoint === 'r2'
        return (
          <li key={review.id} className="emp-wf-review-card">
            <div className="emp-wf-review-card-head">
              <div>
                <h3 className="emp-wf-review-card-title">{review.cellName}</h3>
                <p className="emp-wf-review-card-meta">
                  {review.assignedEmployeeName || 'Unassigned'} · {String(review.reviewPoint || '').toUpperCase()} · {review.stageAtRequest}
                </p>
              </div>
              <span className={cn('emp-wf-review-status', 'emp-wf-review-status--pending')}>Pending</span>
            </div>
            <div className="emp-wf-admin-review-actions">
              <button
                type="button"
                className="emp-wf-admin-review-btn emp-wf-admin-review-btn--approve"
                disabled={isSaving}
                onClick={() => void handleResolve(review, 'approved')}
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Approve'}
              </button>
              {isR2 ? (
                <>
                  <button
                    type="button"
                    className="emp-wf-admin-review-btn emp-wf-admin-review-btn--reject"
                    disabled={isSaving}
                    onClick={() => void handleResolve(review, 'rejected', 'routing')}
                  >
                    Reject → Routing
                  </button>
                  <button
                    type="button"
                    className="emp-wf-admin-review-btn emp-wf-admin-review-btn--reject"
                    disabled={isSaving}
                    onClick={() => void handleResolve(review, 'rejected', 'floor_plan')}
                  >
                    Reject → Floor Plan
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="emp-wf-admin-review-btn emp-wf-admin-review-btn--reject"
                  disabled={isSaving}
                  onClick={() => void handleResolve(review, 'rejected', 'floor_plan')}
                >
                  Reject → Floor Plan
                </button>
              )}
              <button
                type="button"
                className="emp-wf-admin-review-btn emp-wf-admin-review-btn--reject"
                disabled={isSaving}
                onClick={() => navigate(`/employee/projects/${projectId}/cells/${review.cellId}`)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open cell
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
