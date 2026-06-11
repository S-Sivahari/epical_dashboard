import { Layers } from 'lucide-react'
import type { CellReview, LayoutStage } from '@/types/projectWorkspace'
import { LAYOUT_STAGE_LABELS } from '@/utils/cellWorkflowUi'
import { Button } from '@components/ui/Button'

export function CellReviewSection({
  reviews,
  saving = false,
  onResolveReview,
}: {
  reviews: CellReview[]
  saving?: boolean
  onResolveReview?: (
    reviewId: string,
    outcome: 'approved' | 'rejected',
    returnToStage?: LayoutStage,
  ) => void
}) {
  return (
    <section className="admin-projects-cell-review-history admin-projects-cell-review-history--compact" aria-label="Reviews">
      <h2 className="admin-projects-cell-review-history-title">
        <Layers className="h-3.5 w-3.5" aria-hidden />
        Reviews
      </h2>
      {reviews.length === 0 ? (
        <p className="admin-projects-cell-review-empty">No reviews yet.</p>
      ) : (
        <ul className="admin-projects-cell-review-history-list">
          {reviews.slice(0, 6).map((review) => {
            const returnOptions: LayoutStage[] =
              review.reviewPoint === 'r2'
                ? ['routing', 'floor_plan']
                : review.reviewPoint === 'r1'
                  ? ['floor_plan']
                  : []
            return (
              <li key={review.id} className="admin-projects-cell-review-history-item">
                <div className="admin-projects-cell-review-item-head">
                  <span className="font-semibold">{review.reviewPoint?.toUpperCase() || 'Review'}</span>
                  <span className="text-slate-500">
                    · {review.stageAtRequest} · {review.outcome || review.status}
                  </span>
                </div>
                {review.messages?.[0] ? (
                  <p className="admin-projects-cell-review-item-body">{review.messages[0].body}</p>
                ) : null}
                {review.status === 'open' && review.reviewPoint && onResolveReview ? (
                  <div className="admin-projects-cell-review-actions">
                    <Button
                      size="sm"
                      disabled={saving}
                      onClick={() => onResolveReview(review.id, 'approved')}
                    >
                      Approve
                    </Button>
                    {returnOptions.map((stage) => (
                      <Button
                        key={stage}
                        size="sm"
                        variant="secondary"
                        disabled={saving}
                        onClick={() => onResolveReview(review.id, 'rejected', stage)}
                      >
                        Reject → {LAYOUT_STAGE_LABELS[stage]}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
