import { Clock } from 'lucide-react'
import { cn } from '@pages/employee/lib/utils'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'
import { DataTable } from '@components/employee/shared/DataTable'
import { LeaveSectionHeader } from './LeaveSectionHeader'

const CARD_CLASS = portalCardClass({ className: 'emp-leave-card' })

export function LeavePendingPanel({ columns, pendingLeaves }) {
  return (
    <InteractiveCard
      className={cn(CARD_CLASS, 'emp-leave-top-panel emp-leave-pending-card flex min-h-0 flex-col')}
    >
      <LeaveSectionHeader
        icon={Clock}
        title="Pending requests"
        compact
        noBorder
        className="emp-leave-section-head"
      />
      <div className="emp-leave-pending-body">
        <DataTable
          columns={columns}
          data={pendingLeaves}
          statusKey="status"
          compact
          emptyMessage="No pending leave requests."
        />
      </div>
    </InteractiveCard>
  )
}
