import type { LucideIcon } from 'lucide-react'
import { TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { NotificationBadge } from '@components/ui/NotificationBadge'
import { cn } from '@/utils/cn'

export type DashboardKpiItem = {
  label: string
  value: number | string
  subtext: string
  icon: LucideIcon
  tone: 'slate' | 'amber' | 'blue' | 'violet'
  route: string
  notificationCount?: number
}

const toneStyles = {
  slate: {
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    value: 'text-slate-900',
    label: 'text-slate-700',
  },
  amber: {
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    value: 'text-amber-600',
    label: 'text-slate-700',
  },
  blue: {
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    value: 'text-blue-600',
    label: 'text-slate-700',
  },
  violet: {
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    value: 'text-violet-600',
    label: 'text-slate-700',
  },
} as const

export function DashboardKpiStrip({
  items,
  loading,
  variant = 'row',
  className,
}: {
  items: DashboardKpiItem[]
  loading?: boolean
  variant?: 'row' | 'column'
  className?: string
}) {
  const navigate = useNavigate()

  return (
    <section
      className={cn(
        'dashboard-kpi-strip',
        variant === 'column' && 'dashboard-kpi-strip--column',
        className,
      )}
      aria-label="Dashboard summary"
    >
      {items.map((item) => {
        const Icon = item.icon
        const tone = toneStyles[item.tone]
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate(item.route)}
            className="dashboard-kpi-card dashboard-kpi-card--link"
            aria-label={`${item.label}: ${loading ? 'loading' : item.value}. ${item.subtext}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={cn('dashboard-kpi-icon relative', tone.iconBg, tone.iconColor)}>
                <Icon className="h-5 w-5" strokeWidth={2} />
                {item.notificationCount != null && item.notificationCount > 0 ? (
                  <NotificationBadge
                    count={item.notificationCount}
                    size="sm"
                    className="-right-1.5 -top-1.5"
                  />
                ) : null}
              </span>
              <TrendingUp
                className={cn(
                  'h-4 w-4 shrink-0 text-slate-300',
                  variant === 'column' && 'hidden',
                )}
                strokeWidth={2}
                aria-hidden
              />
            </div>
            <p className={cn('dashboard-kpi-value', tone.value)}>
              {loading ? '—' : item.value}
            </p>
            <p className={cn('dashboard-kpi-label', tone.label)}>{item.label}</p>
            <p className="dashboard-kpi-subtext">{item.subtext}</p>
          </button>
        )
      })}
    </section>
  )
}
