import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { Badge } from '@components/ui/Badge'

export function ProfileSidebarCard({
  avatar,
  name,
  subtitle,
  badge,
  stats,
  details,
  actions,
  className,
}: {
  avatar: ReactNode
  name: string
  subtitle?: string
  badge?: { label: string; variant?: 'success' | 'warning' | 'danger' | 'neutral' | 'primary' }
  stats?: { label: string; value: string | number; icon: ReactNode }[]
  details?: { label: string; value?: string | null }[]
  actions?: ReactNode
  className?: string
}) {
  return (
    <aside className={cn('vuexy-profile-card', className)}>
      <div className="flex flex-col items-center text-center">
        <div className="vuexy-profile-avatar-wrap">{avatar}</div>
        <h2 className="mt-3 font-display text-lg font-semibold text-[#5e5873]">{name}</h2>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
        {badge ? (
          <Badge variant={badge.variant === 'primary' ? 'info' : (badge.variant ?? 'info')} className="mt-2">
            {badge.label}
          </Badge>
        ) : null}
      </div>

      {stats && stats.length > 0 ? (
        <div className="vuexy-profile-stats mt-5 grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="vuexy-profile-stat-tile">
              <div className="mb-1 text-muted">{s.icon}</div>
              <p className="font-display text-lg font-bold text-[#5e5873]">{s.value}</p>
              <p className="text-xs text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {details && details.length > 0 ? (
        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Details</p>
          <ul className="space-y-2.5">
            {details.map((d) => (
              <li key={d.label} className="flex items-start justify-between gap-3 text-sm">
                <span className="shrink-0 text-muted">{d.label}</span>
                <span className="text-right font-medium text-[#6e6b7b]">{d.value || '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {actions ? <div className="mt-5 flex flex-col gap-2 sm:flex-row">{actions}</div> : null}
    </aside>
  )
}
