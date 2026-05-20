import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

export function KPICard({
  title,
  value,
  trend,
  icon: Icon,
  color = '#16a34a',
}: {
  title: string
  value: string | number
  trend?: { direction: 'up' | 'down'; label: string }
  icon: LucideIcon
  color?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{title}</p>
          <p className="mt-2 font-display text-2xl font-semibold text-ink">{value}</p>
          {trend ? (
            <p
              className={cn(
                'mt-1 text-xs font-medium',
                trend.direction === 'up' ? 'text-success' : 'text-danger',
              )}
            >
              {trend.direction === 'up' ? '▲' : '▼'} {trend.label}
            </p>
          ) : null}
        </div>
        <span
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  )
}
