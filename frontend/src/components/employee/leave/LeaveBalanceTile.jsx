import { cn } from '@pages/employee/lib/utils'
import {
  balanceTileLabel,
  formatBalanceAmount,
  getBalanceRemainingTone,
  isBalanceActive,
} from './leaveRequestUtils'

export function LeaveBalanceTile({ balance, isSelected = false, variant = 'compact' }) {
  const active = isBalanceActive(balance)
  const isLop = Boolean(balance.isLop)
  const isSidebar = variant === 'sidebar'
  const remaining = formatBalanceAmount(balance.remaining)
  const total = formatBalanceAmount(balance.total)
  const remainingTone = isLop ? null : getBalanceRemainingTone(balance.remaining)

  return (
    <div
      className={cn(
        'emp-leave-balance-tile',
        isSidebar && 'emp-leave-balance-tile--sidebar',
        balance.key === 'compensation' && 'emp-leave-balance-tile--compensation',
        isLop && 'emp-leave-balance-tile--lop',
        active ? 'emp-leave-balance-tile--active' : 'emp-leave-balance-tile--inactive',
        isSelected && 'emp-leave-balance-tile--selected',
      )}
      style={{ '--balance-accent': balance.color }}
      aria-label={`${balanceTileLabel(balance)}: ${
        isLop
          ? `${balance.used} taken`
          : `${remaining} remaining of ${total} total`
      }`}
    >
      <span className="emp-leave-balance-tile__label">{balanceTileLabel(balance)}</span>

      <div className="emp-leave-balance-tile__main">
        {isLop ? (
          <>
            <span className="emp-leave-balance-tile__num emp-leave-balance-tile__num--lop">
              {formatBalanceAmount(balance.used)}
            </span>
            <span className="emp-leave-balance-tile__meta">taken</span>
          </>
        ) : (
          <span
            className={cn(
              'emp-leave-balance-tile__num',
              remainingTone && `emp-leave-balance-tile__num--${remainingTone}`,
            )}
          >
            {remaining}
          </span>
        )}
      </div>

      {!isLop ? (
        <span className="emp-leave-balance-tile__total">Total : {total}</span>
      ) : null}
    </div>
  )
}
