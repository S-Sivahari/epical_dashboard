import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import type { ProjectMinCapacityMetrics } from '@/types/pdkMetalRouting'
import { cn } from '@/utils/cn'

function useAnimatedMa(value: number, durationMs = 500) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)

  useEffect(() => {
    const start = prevRef.current
    const end = value
    const startTime = performance.now()

    function tick(now: number) {
      const progress = Math.min((now - startTime) / durationMs, 1)
      const eased = 1 - (1 - progress) ** 3
      setDisplay(start + (end - start) * eased)
      if (progress < 1) requestAnimationFrame(tick)
      else prevRef.current = end
    }

    requestAnimationFrame(tick)
  }, [value, durationMs])

  return display
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  if (diffMs < 60_000) return 'Just now'
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function computeIndicatorPercent(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.min(100, Math.max(0, (value / max) * 100))
}

function CapacitySkeleton() {
  return (
    <div className="metal-routing-viz-skeleton metal-routing-viz-skeleton--capacity metal-routing-min-capacity-skeleton">
      <div className="metal-routing-min-capacity-skeleton__header" />
      <div className="metal-routing-min-capacity-skeleton__scale" />
      <div className="metal-routing-min-capacity-skeleton__meta" />
    </div>
  )
}

export function MetalRoutingMinCapacityCard({
  metrics,
  loading,
}: {
  metrics: ProjectMinCapacityMetrics
  loading?: boolean
}) {
  const [scaleHover, setScaleHover] = useState(false)
  const animatedValue = useAnimatedMa(metrics.minimumMetalCurrentCapacity)
  const indicatorPercent = useMemo(
    () => computeIndicatorPercent(metrics.minimumMetalCurrentCapacity, metrics.maximumCapacityInProject),
    [metrics.minimumMetalCurrentCapacity, metrics.maximumCapacityInProject],
  )

  if (loading) {
    return <CapacitySkeleton />
  }

  if (!metrics.hasData) {
    return (
      <article className="metal-routing-viz-card metal-routing-viz-card--capacity metal-routing-min-capacity-card is-empty">
        <header className="metal-routing-min-capacity-card__header">
          <span className="metal-routing-min-capacity-card__icon" aria-hidden>
            <Zap className="h-4 w-4" />
          </span>
          <div>
            <h3 className="metal-routing-min-capacity-card__title">Minimum Metal Current Capacity</h3>
            <p className="metal-routing-min-capacity-card__empty">No capacity data available</p>
          </div>
        </header>
        <p className="metal-routing-min-capacity-card__empty-hint">
          Complete metal rows on routes to calculate current carrying capacity.
        </p>
      </article>
    )
  }

  return (
    <article className="metal-routing-viz-card metal-routing-viz-card--capacity metal-routing-min-capacity-card">
      <header className="metal-routing-min-capacity-card__header">
        <span className="metal-routing-min-capacity-card__icon" aria-hidden>
          <Zap className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="metal-routing-min-capacity-card__title">Minimum Metal Current Capacity</h3>
          <p className="metal-routing-min-capacity-card__value">
            <motion.span layout>{animatedValue.toFixed(2)}</motion.span> mA
          </p>
          <p className="metal-routing-min-capacity-card__desc">
            Lowest current carrying capacity detected across all metal layers
          </p>
        </div>
      </header>

      <div
        className="metal-routing-min-capacity-card__scale-wrap"
        onMouseEnter={() => setScaleHover(true)}
        onMouseLeave={() => setScaleHover(false)}
      >
        <div className="metal-routing-min-capacity-scale" aria-hidden>
          <span className="metal-routing-min-capacity-scale__label is-top">
            {metrics.maximumCapacityInProject.toFixed(2)} mA
          </span>
          <div className="metal-routing-min-capacity-scale__track">
            <motion.span
              className={cn('metal-routing-min-capacity-scale__dot', scaleHover && 'is-hovered')}
              initial={false}
              animate={{ bottom: `${indicatorPercent}%` }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <span className="metal-routing-min-capacity-scale__label is-bottom">0 mA</span>
        </div>

        {scaleHover ? (
          <div className="metal-routing-min-capacity-scale__tooltip" role="tooltip">
            <p className="metal-routing-min-capacity-scale__tooltip-title">Minimum Capacity</p>
            <p>{metrics.minimumMetalCurrentCapacity.toFixed(2)} mA</p>
            <p>
              {indicatorPercent.toFixed(1)}% of project max ({metrics.maximumCapacityInProject.toFixed(2)} mA)
            </p>
          </div>
        ) : null}
      </div>

      <dl className="metal-routing-min-capacity-card__meta">
        <div>
          <dt>Current Value</dt>
          <dd>{metrics.minimumMetalCurrentCapacity.toFixed(2)} mA</dd>
        </div>
        <div>
          <dt>Minimum Layer</dt>
          <dd>{metrics.minimumLayer ?? '—'}</dd>
        </div>
        <div>
          <dt>Last Updated</dt>
          <dd>{formatRelativeTime(metrics.lastUpdatedAt)}</dd>
        </div>
      </dl>
    </article>
  )
}
