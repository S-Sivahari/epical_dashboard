import { motion } from 'framer-motion'
import { Progress } from '@components/employee/ui/progress'
import { cn } from '@pages/employee/lib/utils'
import { portalCardClass } from '@components/employee/shared/interactiveCard'

export function LeaveCard({
  type,
  used,
  total,
  remaining: remainingProp,
  color,
  embedded = false,
  compact = false,
  tintClass,
  className,
}) {
  const remaining =
    remainingProp != null
      ? remainingProp
      : total > 0
        ? Math.max(0, total - used)
        : 0
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const shortType = type.replace(' Leave', '').replace(' Days', '')

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-white/90 px-2 py-1.5',
          tintClass,
          className,
        )}
      >
        <span className="truncate text-[11px] font-medium text-foreground">{shortType}</span>
        <span className="shrink-0 text-xs font-bold tabular-nums" style={{ color }}>
          {remaining}
        </span>
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
