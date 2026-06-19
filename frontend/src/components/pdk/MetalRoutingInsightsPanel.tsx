import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'
import { MetalRoutingStatSkeleton } from '@components/pdk/MetalRoutingSkeleton'

export interface MetalRoutingInsightCard {
  label: string
  value: number | string
  hint: string
  icon: LucideIcon
  tone: 'green' | 'blue' | 'amber' | 'emerald' | 'violet' | 'orange'
}

const toneStyles = {
  green: { iconWrap: 'bg-emerald-50 text-emerald-700', value: 'text-ink' },
  blue: { iconWrap: 'bg-blue-50 text-blue-600', value: 'text-ink' },
  amber: { iconWrap: 'bg-amber-50 text-amber-600', value: 'text-ink' },
  emerald: { iconWrap: 'bg-emerald-50 text-emerald-700', value: 'text-ink' },
  violet: { iconWrap: 'bg-violet-50 text-violet-600', value: 'text-ink' },
  orange: { iconWrap: 'bg-orange-50 text-orange-600', value: 'text-ink' },
} as const

export function MetalRoutingInsightsPanel({
  cards,
  loading,
  title = 'Insights',
  embedded,
  compact,
}: {
  cards: MetalRoutingInsightCard[]
  loading?: boolean
  title?: string
  embedded?: boolean
  compact?: boolean
}) {
  const Wrapper = embedded ? 'div' : 'aside'
  const wrapperProps = embedded
    ? { className: cn('metal-routing-insights-embedded', compact && 'metal-routing-insights-embedded--compact') }
    : { className: 'metal-routing-insights-sidebar', 'aria-label': title }

  if (loading) {
    return (
      <Wrapper {...wrapperProps}>
        <h2 className="metal-routing-insights-title">{title}</h2>
        <MetalRoutingStatSkeleton count={cards.length} />
      </Wrapper>
    )
  }

  return (
    <Wrapper {...wrapperProps}>
      <h2 className="metal-routing-insights-title">{title}</h2>
      <div className="metal-routing-insights-stack">
        {cards.map((card) => {
          const Icon = card.icon
          const tone = toneStyles[card.tone]
          return (
            <article
              key={card.label}
              className={cn('metal-routing-insight-card', compact && 'metal-routing-insight-card--compact')}
            >
              <div className="min-w-0">
                <p className="metal-routing-insight-label">{card.label}</p>
                <p className={cn('metal-routing-insight-value', tone.value)}>{card.value}</p>
                {card.hint ? <p className="metal-routing-insight-hint">{card.hint}</p> : null}
              </div>
              <span className={cn('metal-routing-insight-icon', tone.iconWrap)} aria-hidden>
                <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
              </span>
            </article>
          )
        })}
      </div>
    </Wrapper>
  )
}
