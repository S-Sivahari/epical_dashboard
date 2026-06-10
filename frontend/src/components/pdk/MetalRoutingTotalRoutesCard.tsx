import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, ChevronRight, Route } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ProjectRouteMetrics, RouteTrendRange } from '@/types/pdkMetalRouting'
import {
  formatRelativeRouteTime,
  getRouteTrendYDomain,
  getTrendForRange,
} from '@/utils/metalRoutingMetricsVisual'
import { MetalRoutingTotalRoutesDetailsModal } from '@components/pdk/MetalRoutingTotalRoutesDetailsModal'
import { cn } from '@/utils/cn'

const RANGE_OPTIONS: { key: RouteTrendRange; label: string }[] = [
  { key: '7', label: '7D' },
  { key: '30', label: '30D' },
  { key: '90', label: '90D' },
]

function useAnimatedNumber(value: number, durationMs = 600) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)

  useEffect(() => {
    const start = prevRef.current
    const end = value
    const startTime = performance.now()

    function tick(now: number) {
      const progress = Math.min((now - startTime) / durationMs, 1)
      const eased = 1 - (1 - progress) ** 3
      setDisplay(Math.round(start + (end - start) * eased))
      if (progress < 1) requestAnimationFrame(tick)
      else prevRef.current = end
    }

    requestAnimationFrame(tick)
  }, [value, durationMs])

  return display
}

function TotalRoutesSkeleton() {
  return (
    <div className="metal-routing-viz-skeleton metal-routing-viz-skeleton--total metal-routing-total-routes-skeleton">
      <div className="metal-routing-total-routes-skeleton__header" />
      <div className="metal-routing-total-routes-skeleton__metric" />
      <div className="metal-routing-total-routes-skeleton__chart" />
      <div className="metal-routing-total-routes-skeleton__insights" />
    </div>
  )
}

export function MetalRoutingTotalRoutesCard({
  metrics,
  projectName,
  loading,
}: {
  metrics: ProjectRouteMetrics
  projectName?: string | null
  loading?: boolean
}) {
  const gradId = useId().replace(/:/g, '')
  const [range, setRange] = useState<RouteTrendRange>('7')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [chartKey, setChartKey] = useState(0)

  const animatedTotal = useAnimatedNumber(metrics.totalRoutes)
  const chartData = metrics.trendsByRange[range]
  const yDomain = useMemo(() => getRouteTrendYDomain(chartData), [chartData])
  const trend = useMemo(() => getTrendForRange(chartData, range), [chartData, range])
  const isUp = trend.delta >= 0

  useEffect(() => {
    setChartKey((key) => key + 1)
  }, [range])

  if (loading) {
    return <TotalRoutesSkeleton />
  }

  return (
    <>
      <motion.article
        layout
        className="metal-routing-viz-card metal-routing-viz-card--total metal-routing-total-routes-card is-interactive"
        onClick={() => setDetailsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setDetailsOpen(true)
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Total Routes ${metrics.totalRoutes}. Open route activity details.`}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
      >
        <div className="metal-routing-total-routes__header">
          <div className="metal-routing-total-routes__title-block">
            <span className="metal-routing-total-routes__title-icon" aria-hidden>
              <Route className="h-4 w-4" />
            </span>
            <div>
              <h3 className="metal-routing-total-routes__title">Total Routes</h3>
              <p className="metal-routing-total-routes__hint">Unique route blocks in this project</p>
            </div>
          </div>
          <div
            className="metal-routing-routes-range"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            role="group"
            aria-label="Route activity time range"
          >
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={cn('metal-routing-routes-range-btn', range === option.key && 'is-active')}
                onClick={() => setRange(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="metal-routing-total-routes__metric-row">
          <p className="metal-routing-total-routes__value">
            <motion.span layout>{animatedTotal.toLocaleString()}</motion.span>
          </p>
          <div className={cn('metal-routing-total-routes__trend', isUp ? 'is-up' : 'is-down')}>
            {isUp ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}
            <span>
              {isUp ? '+' : ''}
              {trend.delta} {trend.periodLabel}
            </span>
            <span className="metal-routing-total-routes__trend-sep">·</span>
            <span>
              {isUp ? '+' : ''}
              {trend.growthPercent}%
            </span>
          </div>
        </div>

        <div className="metal-routing-total-routes__chart" onClick={(event) => event.stopPropagation()}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart key={chartKey} data={chartData} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id={`routeActivityGrad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.16)" vertical={false} strokeDasharray="4 5" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={18}
              />
              <YAxis
                domain={yDomain}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={32}
                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(37, 99, 235, 0.22)', strokeWidth: 1 }}
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                  fontSize: 12,
                }}
                formatter={(value: number, _name, item) => {
                  const added = (item?.payload as { added?: number })?.added ?? 0
                  return [`${Number(value).toLocaleString()} (+${added} new)`, 'Routes']
                }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#2563eb"
                strokeWidth={2}
                fill={`url(#routeActivityGrad-${gradId})`}
                animationDuration={350}
                dot={false}
                activeDot={{ r: 4, fill: '#1d4ed8', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <ul className="metal-routing-total-routes__insights">
          <li>
            <span className="metal-routing-total-routes__insight-label">Most Active Cell</span>
            <span className="metal-routing-total-routes__insight-value">
              {metrics.insights.mostActiveCell ?? '—'}
            </span>
          </li>
          <li>
            <span className="metal-routing-total-routes__insight-label">Most Active Library</span>
            <span className="metal-routing-total-routes__insight-value">
              {metrics.insights.mostActiveLibrary ?? '—'}
            </span>
          </li>
          <li>
            <span className="metal-routing-total-routes__insight-label">Latest Route Added</span>
            <span className="metal-routing-total-routes__insight-value">
              {formatRelativeRouteTime(metrics.insights.latestRouteAddedAt)}
            </span>
          </li>
        </ul>

        <div className="metal-routing-total-routes__footer">
          <span>View route analytics</span>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </div>
      </motion.article>

      <MetalRoutingTotalRoutesDetailsModal
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        metrics={metrics}
        projectName={projectName ?? null}
        range={range}
        onRangeChange={setRange}
      />
    </>
  )
}
