import { BarChart3 } from 'lucide-react'
import { LeaveCard } from '@components/employee/shared/LeaveCard'

const LEAVE_TYPE_TO_KEY = {
  'Casual Leave': 'casual',
  'Sick Leave': 'sick',
  'Earned Leave': 'earned',
  'Compensation Leave': 'compensation',
  LOP: 'lop',
}

export function LeaveBalanceColumn({ balances, selectedLeaveType }) {
  const selectedKey = selectedLeaveType ? LEAVE_TYPE_TO_KEY[selectedLeaveType] : null

  return (
    <aside className="emp-leave-balance-column" aria-label="Leave balance">
      <div className="emp-leave-balance-column__head">
        <BarChart3 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span className="emp-leave-balance-column__title">Leave balance</span>
      </div>
      <div className="emp-leave-balance-column__list">
        {balances.map((balance) => (
          <LeaveCard
            key={balance.key}
            compact
            type={balance.type}
            used={balance.used}
            total={balance.total}
            remaining={balance.remaining}
            selected={selectedKey === balance.key}
          />
        ))}
      </div>
    </aside>
  )
}
