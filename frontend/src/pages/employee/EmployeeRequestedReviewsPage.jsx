import { useOutletContext } from 'react-router-dom'
import { ClipboardCheck } from 'lucide-react'
import { EmployeeRequestedReviewsPanel } from '@components/employee/projects/EmployeeRequestedReviewsPanel'
import { EmployeeProjectBreadcrumb } from '@components/employee/projects/EmployeeProjectBreadcrumb'

export default function EmployeeRequestedReviewsPage() {
  const { reviews, loadingReviews } = useOutletContext()
  const pendingCount = reviews.filter((review) => review.status === 'open').length

  return (
    <div className="emp-wf-surface emp-wf-hub-surface">
      <EmployeeProjectBreadcrumb items={[{ label: 'Projects' }, { label: 'Requested Reviews' }]} />

      <header className="emp-wf-hub-hero">
        <div>
          <p className="emp-wf-hub-eyebrow">Review queue</p>
          <h1 className="emp-wf-hub-title">Requested Reviews</h1>
          <p className="emp-wf-hub-subtitle">
            Track review requests you submitted and open admin outcomes.
          </p>
        </div>
        <div className="emp-wf-hub-hero-badge">
          <ClipboardCheck className="h-4 w-4" aria-hidden />
          {pendingCount} pending
        </div>
      </header>

      <EmployeeRequestedReviewsPanel reviews={reviews} loading={loadingReviews} />
    </div>
  )
}
