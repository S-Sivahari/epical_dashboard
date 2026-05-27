import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

export function KPICard({
  title,
  value,
  trend,
  icon: Icon,
  color = '#059669',
}: {
  title: string
  value: string | number
  trend?: { direction: 'up' | 'down'; label: string }
  icon: LucideIcon
  color?: string
}) {
  return (
    <div className="rounded-2xl border border-emerald-100/50 bg-white p-5 shadow-[0_4px_24px_-6px_rgba(15,118,110,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
          {trend ? (
            <p
              className={cn(
                'mt-2 inline-flex items-center gap-0.5 text-xs font-semibold',
                trend.direction === 'up' ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              <span>{trend.direction === 'up' ? '▲' : '▼'}</span>
              <span>{trend.label}</span>
            </p>
          ) : null}
        </div>
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg shadow-black/15"
          style={{ backgroundColor: color }}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
      </div>
    </div>
  )
}
