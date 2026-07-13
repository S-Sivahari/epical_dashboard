import { BarChart3 } from 'lucide-react'
import { cn } from '@pages/employee/lib/utils'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'
import { LeaveSectionHeader } from './LeaveSectionHeader'
import { LeaveCard } from '@components/employee/shared/LeaveCard'

const CARD_CLASS = portalCardClass({ className: 'emp-leave-card' })

const LEAVE_TYPE_TO_KEY = {
  'Casual Leave': 'casual',
  'Sick Leave': 'sick',
  'Earned Leave': 'earned',
  'Compensation Leave': 'compensation',
  LOP: 'lop',
}

export function LeaveBalancePanel({ balances, selectedLeaveType }) {
  const selectedKey = selectedLeaveType ? LEAVE_TYPE_TO_KEY[selectedLeaveType] : null

  return (
    <InteractiveCard className={cn(CARD_CLASS, 'emp-leave-top-panel emp-leave-balance-card emp-leave-balance-card--compact')}>
      <LeaveSectionHeader
        icon={BarChart3}
        title="Leave balance"
        noBorder
        compact
        className="emp-leave-balance-head emp-leave-balance-head--compact"
      />
      <div className="emp-leave-balance-panel-list">
        {balances.map((balance) => (
          <LeaveCard
            key={balance.key}
            compact
            type={balance.type}
            used={balance.used}
            total={balance.total}
            remaining={balance.remaining}
            pending={balance.pending}
            approved={balance.approved}
            selected={selectedKey === balance.key}
          />
        ))}
      </div>
    </InteractiveCard>
  )
}
