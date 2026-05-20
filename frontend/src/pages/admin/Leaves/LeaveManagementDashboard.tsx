import { Breadcrumb } from '@components/layout/Breadcrumb'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { PendingLeaves } from './PendingLeaves'
import { ApprovedLeaves } from './ApprovedLeaves'
import { CompensationLeaves } from './CompensationLeaves'
import { HolidayManagement } from './HolidayManagement'

export function LeaveManagementDashboard() {

  return (
    <PageWrapper>
      <PageHeader
        title="Leave Management"
        subtitle="Manage pending approvals, compensation credits, and public holidays from one dashboard."
        breadcrumb={<Breadcrumb items={[{ label: 'Leaves', to: '/admin/leaves' }]} />}
      />

      {/* Content Sections - Unified View */}
      <div className="flex flex-col gap-8">
        {/* Pending Leaves Section */}
        <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
            <span className="text-xl">⏳</span>
            <h2 className="font-display text-lg font-semibold text-ink">Pending Leave Approvals</h2>
          </div>
          <PendingLeaves />
        </section>

        {/* Approved Leaves Section */}
        <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
            <span className="text-xl">✅</span>
            <h2 className="font-display text-lg font-semibold text-ink">Approved Leave Requests & Status</h2>
          </div>
          <ApprovedLeaves />
        </section>

        {/* Compensation Section */}
        <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
            <span className="text-xl">🎯</span>
            <h2 className="font-display text-lg font-semibold text-ink">Compensation Credits</h2>
          </div>
          <CompensationLeaves />
        </section>

        {/* Holidays Section */}
        <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
            <span className="text-xl">🎉</span>
            <h2 className="font-display text-lg font-semibold text-ink">Public Holidays</h2>
          </div>
          <HolidayManagement />
        </section>
      </div>
    </PageWrapper>
  )
}
