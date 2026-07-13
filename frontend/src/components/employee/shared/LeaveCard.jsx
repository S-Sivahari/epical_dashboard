import { motion } from 'framer-motion'
import { Progress } from '@components/employee/ui/progress'
import { cn } from '@pages/employee/lib/utils'
import { portalCardClass } from '@components/employee/shared/interactiveCard'

const LEAVE_CARD_CLASS = {
  'Casual Leave': 'admin-leaves-balance-card--casual',
  'Sick Leave': 'admin-leaves-balance-card--sick',
  'Earned Leave': 'admin-leaves-balance-card--earned',
  'Compensation Leave': 'admin-leaves-balance-card--comp',
  'LOP Days': 'admin-leaves-balance-card--lop',
}

function dayLabel(count) {
  return count === 1 ? 'day' : 'days'
}

export function LeaveCard({
  type,
  used,
  total,
  remaining: remainingProp,
  color,
  embedded = false,
  compact = false,
  tintClass,
  selected = false,
  className,
}) {
  const remaining =
    remainingProp != null
      ? remainingProp
      : total > 0
        ? Math.max(0, total - used)
        : 0
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const isLop = type === 'LOP Days'

  if (compact) {
    return (
      <div
        className={cn(
          'admin-leaves-balance-card',
          LEAVE_CARD_CLASS[type],
          selected && 'admin-leaves-balance-card--selected',
          className,
        )}
      >
        <p className="admin-leaves-balance-card__title">{type}</p>
        <div className="admin-leaves-balance-card__controls admin-leaves-balance-card__controls--static">
          <span
            className={cn(
              'admin-leaves-balance-card__value',
              isLop && 'admin-leaves-balance-card__value--lop',
            )}
          >
            {isLop ? used : remaining}
          </span>
        </div>
        <ul className="admin-leaves-balance-card__meta">
          {isLop ? (
            <li className="admin-leaves-balance-card__meta-month">
              <span>Availed this month:</span> <strong>{used}</strong> {dayLabel(used)}
            </li>
          ) : (
            <>
              <li>
                <span>Used:</span> <strong>{used}</strong> {dayLabel(used)}
              </li>
              <li>
                <span>Total:</span> <strong>{total}</strong> {dayLabel(total)}
              </li>
            </>
          )}
        </ul>
      </div>
    )
  }

  return (
    <motion.div
      whileHover={embedded ? false : { scale: 1.02 }}
      data-portal-card=""
      className={cn(
        'flex h-full flex-col p-4',
        embedded
          ? portalCardClass({ subtle: true, className: cn('shadow-none', tintClass) })
          : portalCardClass({ className: 'shadow-card' }),
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-heading text-sm font-semibold">{type}</span>
        <span className="text-xs font-medium" style={{ color }}>
          {remaining} left
        </span>
      </div>
      <Progress value={pct} indicatorClassName="bg-primary" style={{ ['--indicator']: color }} />
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>Used: {used}</span>
        <span>Total: {total}</span>
      </div>
    </motion.div>
  )
}
