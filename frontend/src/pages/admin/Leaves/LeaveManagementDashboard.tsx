import { useState } from 'react'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { PendingLeaves } from './PendingLeaves'
import { ApprovedLeaves } from './ApprovedLeaves'
import { RejectedLeaves } from './RejectedLeaves'
import { CompensationLeaves } from './CompensationLeaves'
import { HolidayManagement } from './HolidayManagement'
import { Input } from '@components/ui/Input'
import { Button } from '@components/ui/Button'
import { Search, X } from 'lucide-react'
import { defaultLeaveFilters, type LeaveFilters } from '@/utils/leaveFilters'

export function LeaveManagementDashboard() {
  const [filters, setFilters] = useState<LeaveFilters>(defaultLeaveFilters)

  const clearFilters = () => setFilters(defaultLeaveFilters)

  return (
    <PageWrapper>
      <PageHeader
        title="Leave Management"
        subtitle="Manage pending approvals, compensation credits, and public holidays from one dashboard."
        breadcrumb={<Breadcrumb items={[{ label: 'Leaves', to: '/admin/leaves' }]} />}
      />

      <div className="rounded-xl border border-border bg-white p-5 shadow-sm mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-ink">Advanced Filters</h3>
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted hover:text-ink">
            <X className="mr-2 h-4 w-4" /> Clear Filters
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Employee Name</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <Input 
                placeholder="Search name..." 
                className="pl-9 h-9 text-sm"
                value={filters.employeeName} 
                onChange={e => setFilters({...filters, employeeName: e.target.value})} 
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Employee ID</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <Input 
                placeholder="Search ID..." 
                className="pl-9 h-9 text-sm"
                value={filters.employeeId} 
                onChange={e => setFilters({...filters, employeeId: e.target.value})} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content Sections - Unified View */}
      <div className="flex flex-col gap-8">
        {/* Pending Leaves Section */}
        <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
            <span className="text-xl">⏳</span>
            <h2 className="font-display text-lg font-semibold text-ink">Pending Leave Approvals</h2>
          </div>
          <PendingLeaves filters={filters} />
        </section>

        {/* Approved Leaves Section */}
        <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
            <span className="text-xl">✅</span>
            <h2 className="font-display text-lg font-semibold text-ink">Approved Leave Requests & Status</h2>
          </div>
          <ApprovedLeaves filters={filters} />
        </section>

        {/* Rejected Leaves Section */}
        <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
            <span className="text-xl">❌</span>
            <h2 className="font-display text-lg font-semibold text-ink">Rejected Leave Requests</h2>
          </div>
          <RejectedLeaves filters={filters} />
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
