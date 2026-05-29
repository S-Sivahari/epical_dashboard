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
    <div className="rounded-2xl border border-emerald-100/60 bg-white p-3.5 shadow-[0_6px_18px_-12px_rgba(15,118,110,0.16)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-1.5 font-display text-[22px] font-semibold tracking-tight text-slate-900">
            {value}
          </p>
          {trend ? (
            <p
              className={cn(
                'mt-2 inline-flex items-center gap-0.5 text-[11px] font-semibold',
                trend.direction === 'up' ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              <span>{trend.direction === 'up' ? '▲' : '▼'}</span>
              <span>{trend.label}</span>
            </p>
          ) : null}
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-emerald-100">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-white shadow-sm"
            style={{ backgroundColor: color }}
          >
            <Icon className="h-[14px] w-[14px]" strokeWidth={2} />
          </span>
        </span>
      </div>
    </div>
  )
}
