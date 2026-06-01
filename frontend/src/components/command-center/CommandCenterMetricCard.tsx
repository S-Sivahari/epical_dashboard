import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

export function CommandCenterMetricCard({
  title,
  value,
  icon: Icon,
  iconColor,
  trend,
  trendUp = true,
  className,
}: {
  title: string
  value: string | number
  icon: LucideIcon
  iconColor: string
  trend: string
  trendUp?: boolean
  className?: string
}) {
  return (
    <div className={cn('metric-card !py-3', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-800">
            {title}
          </p>
          <p className="metric-value mt-1 font-display text-xl font-bold tabular-nums">
            {value}
          </p>
          <p
            className={cn(
              'mt-1 inline-flex items-center gap-0.5 text-[10px] font-semibold',
              trendUp ? 'metric-trend-up' : 'metric-trend-down',
            )}
          >
            <span>{trendUp ? '▲' : '▼'}</span>
            <span>{trend}</span>
          </p>
        </div>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${iconColor}22`, color: iconColor }}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>
    </div>
  )
}
