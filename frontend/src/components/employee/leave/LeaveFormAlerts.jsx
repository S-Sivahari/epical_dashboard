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

function formatSplitMessage(paid, lop, leaveLabel) {
  if (lop <= 0) return null
  if (paid <= 0) {
    return (
      <>
        This request will be recorded entirely as <strong>LOP</strong> ({lop} day
        {lop === 1 ? '' : 's'}) and will not use your {leaveLabel} balance.
      </>
    )
  }
  return (
    <>
      {paid} day{paid === 1 ? '' : 's'} will use {leaveLabel}; {lop} day
      {lop === 1 ? '' : 's'} will be recorded as <strong>LOP</strong>.
    </>
  )
}

export function LeaveFormAlerts({
  showLopNotice,
  selectedLeaveType,
  casualBalanceRemaining,
  sickBalanceRemaining,
  earnedBalanceRemaining,
  isCasualSameDay,
  holidayWarning,
  requestedWorkingDays,
}) {
  const requestedDays = Number(requestedWorkingDays)
  const hasRequestedDays = Number.isFinite(requestedDays) && requestedDays > 0

  const casualPaid =
    selectedLeaveType === 'Casual Leave' && hasRequestedDays
      ? isCasualSameDay
        ? 0
        : Math.min(requestedDays, Math.max(0, casualBalanceRemaining))
      : 0
  const casualLop =
    selectedLeaveType === 'Casual Leave' && hasRequestedDays
      ? Math.max(0, requestedDays - casualPaid)
      : 0

  const sickPaid =
    selectedLeaveType === 'Sick Leave' && hasRequestedDays
      ? Math.min(requestedDays, Math.max(0, sickBalanceRemaining))
      : 0
  const sickLop =
    selectedLeaveType === 'Sick Leave' && hasRequestedDays
      ? Math.max(0, requestedDays - sickPaid)
      : 0

  return (
    <div className="flex flex-col gap-2">
      {showLopNotice ? (
        <InlineAlert tone="red">
          This request will be recorded as <strong>LOP (Loss of Pay)</strong> and added to your LOP
          count.
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
          month. Apply before your leave date for paid casual leave.
        </p>
      ) : null}

      {selectedLeaveType === 'Casual Leave' && isCasualSameDay ? (
        <InlineAlert>
          Same-day casual leave is treated entirely as <strong>LOP</strong> and will not deduct from
          your casual balance.
        </InlineAlert>
      ) : null}

      {selectedLeaveType === 'Casual Leave' && casualLop > 0 && !isCasualSameDay ? (
        <InlineAlert>{formatSplitMessage(casualPaid, casualLop, 'Casual Leave')}</InlineAlert>
      ) : null}

      {selectedLeaveType === 'Sick Leave' && sickLop > 0 ? (
        <InlineAlert>{formatSplitMessage(sickPaid, sickLop, 'Sick Leave')}</InlineAlert>
      ) : null}

      {holidayWarning ? <InlineAlert>{holidayWarning}</InlineAlert> : null}
    </div>
  )
}
