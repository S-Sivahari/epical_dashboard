import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

export function CommandCenterMetricCard({
  title,
  value,
  icon: Icon,
  trend,
  trendUp = true,
  className,
}: {
  title: string
  value: string | number
  icon: LucideIcon
  trend: string
  trendUp?: boolean
  className?: string
}) {
  return (
    <div className={cn('dashboard-metric-card dashboard-metric-card-circle', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="dashboard-metric-label">{title}</p>
        <span className="dashboard-metric-icon-sm">
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      </div>
      <div className="dashboard-metric-circle-wrap">
        <div className="dashboard-metric-circle">
          <span className="dashboard-metric-circle-value">{value}</span>
        </div>
      </div>
      <p
        className={cn(
          'dashboard-metric-trend dashboard-metric-trend-below',
          trendUp ? 'dashboard-metric-trend-up' : 'dashboard-metric-trend-down',
        )}
      >
        <span aria-hidden>{trendUp ? '▲' : '▼'}</span>
        <span>{trend}</span>
      </p>
    </div>
  )
}
