import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

export function KPICard({
  title,
  value,
  trend,
  icon: Icon,
  color = '#059669',
  className,
}: {
  title: string
  value: string | number
  trend?: { direction: 'up' | 'down'; label: string }
  icon: LucideIcon
  color?: string
  className?: string
}) {
  const isBrand = className?.includes('admin-dash-card')

  return (
    <div
      className={cn(
        'rounded-xl border border-zinc-700/50 bg-[#27272a] p-3.5 shadow-[0_6px_18px_-12px_rgba(0,0,0,0.3)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-[11px] font-medium uppercase tracking-wide',
              isBrand ? 'text-[#71717a]' : 'text-[#8892a4]',
            )}
          >
            {title}
          </p>
          <p className="mt-1.5 font-display text-[22px] font-semibold tracking-tight text-white">
            {value}
          </p>
          {trend ? (
            <p
              className={cn(
                'mt-2 inline-flex items-center gap-0.5 text-[11px] font-semibold',
                trend.direction === 'up'
                  ? isBrand
                    ? 'text-[#22c55e]'
                    : 'text-[#2ecc71]'
                  : 'text-rose-500',
              )}
            >
              <span>{trend.direction === 'up' ? '▲' : '▼'}</span>
              <span>{trend.label}</span>
            </p>
          ) : null}
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3f3f46]">
          <Icon className="h-[18px] w-[18px]" style={{ color }} strokeWidth={2} />
        </span>
      </div>
    </div>
  )
}
