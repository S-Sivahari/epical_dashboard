import { AlertTriangle } from 'lucide-react'

function InlineAlert({ children, tone = 'amber' }) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    red: 'border-red-200 bg-red-50 text-red-900',
  }
  const iconTones = {
    amber: 'text-amber-600',
    red: 'text-red-600',
  }

  return (
    <div
      className={`emp-leave-inline-alert flex items-start gap-2 rounded-lg border ${tones[tone]}`}
      role="status"
    >
      <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${iconTones[tone]}`} aria-hidden />
      <span className="text-xs leading-relaxed">{children}</span>
    </div>
  )
}

export function LeaveFormAlerts({
  showLopNotice,
  selectedLeaveType,
  casualBalanceRemaining,
  earnedBalanceRemaining,
  isCasualSameDay,
  holidayWarning,
}) {
  return (
    <div className="flex flex-col gap-2">
      {showLopNotice ? (
        <InlineAlert tone="red">
          This request will be recorded as <strong>LOP (Loss of Pay)</strong> and added to your LOP
          count.
        </InlineAlert>
      ) : null}

      {selectedLeaveType === 'Casual Leave' && casualBalanceRemaining <= 0 ? (
        <InlineAlert>
          Your casual leave balance is used up. Select <strong>LOP</strong> to apply unpaid leave.
        </InlineAlert>
      ) : null}

      {selectedLeaveType === 'Earned Leave' && earnedBalanceRemaining <= 0 ? (
        <InlineAlert>
          Your earned leave balance is used up. Select <strong>LOP</strong> to apply unpaid leave.
        </InlineAlert>
      ) : null}

      {selectedLeaveType === 'Casual Leave' && casualBalanceRemaining > 0 && !isCasualSameDay ? (
        <p className="text-xs leading-relaxed text-muted">
          {casualBalanceRemaining} casual day{casualBalanceRemaining === 1 ? '' : 's'} left this
          month. Apply before your leave date. If you need more days, submit separate casual and LOP
          requests.
        </p>
      ) : null}

      {selectedLeaveType === 'Casual Leave' && isCasualSameDay ? (
        <InlineAlert>
          Same-day leave cannot be casual. Select <strong>LOP</strong> instead.
        </InlineAlert>
      ) : null}

      {holidayWarning ? <InlineAlert>{holidayWarning}</InlineAlert> : null}
    </div>
  )
}
