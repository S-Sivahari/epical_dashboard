import { Link, useOutletContext } from 'react-router-dom'
import { ArrowLeft, ClipboardCheck } from 'lucide-react'
import { EmployeeRequestedReviewsPanel } from '@components/employee/projects/EmployeeRequestedReviewsPanel'

export default function EmployeeRequestedReviewsPage() {
  const { reviews, loadingReviews } = useOutletContext()
  const pendingCount = reviews.filter((review) => review.status === 'open').length

  return (
    <div className="admin-projects-shell relative z-10 flex min-h-0 flex-1 flex-col">
      <header className="admin-projects-head">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <Link
            to="/employee/projects"
            className="admin-projects-back-btn"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            All projects
          </Link>
          <div className="flex min-w-0 items-center gap-2.5 border-l border-white/20 pl-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
              <ClipboardCheck className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="admin-projects-head-title">Requested Reviews</h1>
              <p className="admin-projects-workspace-meta">
                {pendingCount} pending · Track review outcomes from admins
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="employee-directory-table-section admin-projects-table-section admin-projects-employee-reviews-section">
        <EmployeeRequestedReviewsPanel reviews={reviews} loading={loadingReviews} />
      </section>
    </div>
  )
}
