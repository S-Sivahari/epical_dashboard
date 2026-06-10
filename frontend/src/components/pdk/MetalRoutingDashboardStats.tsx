import type { LucideIcon } from 'lucide-react'

import { cn } from '@/utils/cn'

import { MetalRoutingStatSkeleton } from '@components/pdk/MetalRoutingSkeleton'



export interface MetalRoutingStatCard {

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



export function MetalRoutingDashboardStats({

  cards,

  loading,

  className,

}: {

  cards: MetalRoutingStatCard[]

  loading?: boolean

  className?: string

}) {

  if (loading) {

    return <MetalRoutingStatSkeleton count={cards.length} />

  }



  return (

    <section

      className={cn('metal-routing-stats-grid', className)}

      aria-label="Dashboard summary"

    >

      {cards.map((card) => {

        const Icon = card.icon

        const tone = toneStyles[card.tone]

        return (

          <article key={card.label} className="metal-routing-stat-card">

            <div className="flex items-start justify-between gap-3">

              <div className="min-w-0">

                <p className="metal-routing-stat-label">{card.label}</p>

                <p className={cn('metal-routing-stat-value mt-1.5', tone.value)}>

                  {card.value}

                </p>

                <p className="mt-2 text-xs leading-relaxed text-muted">{card.hint}</p>

              </div>

              <span

                className={cn(

                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',

                  tone.iconWrap,

                )}

                aria-hidden

              >

                <Icon className="h-5 w-5" />

              </span>

            </div>

          </article>

        )

      })}

    </section>

  )

}

