import { cn } from '@/utils/cn'

export interface StatItem {
  label: string
  value: number | string
  color?: string
  sub?: string
}

export function AnalyticsStatGrid({ stats, columns = 4 }: { stats: StatItem[]; columns?: 2 | 3 | 4 | 5 }) {
  const gridCols = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
    5: 'sm:grid-cols-2 lg:grid-cols-5',
  }

  return (
    <div className={cn('grid gap-3', gridCols[columns])}>
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-border bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
        >
          <p className={cn('text-2xl font-bold tabular-nums', s.color || 'text-ink')}>{s.value}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{s.label}</p>
          {s.sub && <p className="mt-0.5 text-[11px] text-muted">{s.sub}</p>}
        </div>
      ))}
    </div>
  )
}
