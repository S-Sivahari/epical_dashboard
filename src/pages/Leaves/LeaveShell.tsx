import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { cn } from '@/utils/cn'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-lg px-3 py-2 text-sm font-medium transition-ui',
    isActive ? 'bg-emerald-50 text-emerald-900 ring-1 ring-primary/30' : 'text-muted hover:bg-surface',
  )

export function LeaveShell() {
  return (
    <PageWrapper>
      <PageHeader
        title="Leave management"
        subtitle="Pending approvals, compensation credits, and holidays."
        breadcrumb={<Breadcrumb items={[{ label: 'Leaves', to: '/dashboard/leaves' }]} />}
      />
      <div className="mb-4 flex flex-wrap gap-2 border-b border-border pb-3">
        <NavLink to="pending" className={tabClass}>
          Pending
        </NavLink>
        <NavLink to="compensation" className={tabClass}>
          Compensation
        </NavLink>
        <NavLink to="holidays" className={tabClass}>
          Holidays
        </NavLink>
      </div>
      <Outlet />
    </PageWrapper>
  )
}

export function LeavesIndexRedirect() {
  return <Navigate to="pending" replace />
}
