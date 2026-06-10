import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  Image,
  Info,
  Minus,
  MoreVertical,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  ImpedanceRoutePoint,
  ImpedanceRunRange,
  ProjectImpedanceMetrics,
} from '@/types/pdkMetalRouting'
import {
  IMPEDANCE_RANGE_OPTIONS,
  computeImpedanceStats,
  computeImpedanceTrend,
  downsampleChartPoints,
  enrichChartPoints,
  exportImpedanceCsv,
  getImpedanceYDomain,
  sliceImpedanceRange,
} from '@/utils/metalRoutingImpedanceVisual'
import { MetalRoutingImpedanceReportModal } from '@components/pdk/MetalRoutingImpedanceReportModal'
import { MetalRoutingImpedanceRouteModal } from '@components/pdk/MetalRoutingImpedanceRouteModal'
import { cn } from '@/utils/cn'

function useAnimatedOhm(value: number, durationMs = 350) {
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

function ImpedanceTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: ImpedanceRoutePoint & { deltaFromAverage: number; percentFromAverage: number } }>
}) {
  if (!active || !payload?.[0]) return null
  const point = payload[0].payload
  return (
    <div className="metal-routing-impedance-tooltip">
      <p className="metal-routing-impedance-tooltip__title">Route {point.routeLabel}</p>
      <p>{point.routeName}</p>
      <p className="metal-routing-impedance-tooltip__value">{point.impedance.toFixed(2)} Ω</p>
      <p>
        vs avg: {point.deltaFromAverage >= 0 ? '+' : ''}
        {point.deltaFromAverage.toFixed(2)} Ω ({point.percentFromAverage >= 0 ? '+' : ''}
        {point.percentFromAverage}%)
      </p>
    </div>
  )
}

function CurrentPointLabel(props: {
  x?: number | string
  y?: number | string
  value?: number | string
  index?: number
  lastIndex: number
}) {
  if (props.index !== props.lastIndex) return null
  const x = Number(props.x ?? 0)
  const y = Number(props.y ?? 0)
  const numeric = Number(props.value ?? 0)
  return (
    <g transform={`translate(${x}, ${y - 14})`}>
      <rect x={-28} y={-11} width={56} height={22} rx={6} className="metal-routing-impedance-badge" />
      <text x={0} y={4} textAnchor="middle" className="metal-routing-impedance-badge__text">
        {numeric.toFixed(2)} Ω
      </text>
    </g>
  )
}

function ImpedanceSkeleton() {
  return (
    <div className="metal-routing-viz-skeleton metal-routing-viz-skeleton--impedance metal-routing-impedance-skeleton">
      <div className="metal-routing-impedance-skeleton__header" />
      <div className="metal-routing-impedance-skeleton__chart" />
      <div className="metal-routing-impedance-skeleton__stats" />
    </div>
  )
}

export function MetalRoutingImpedanceCard({
  metrics,
  projectName,
  loading,
}: {
  metrics: ProjectImpedanceMetrics
  projectName?: string | null
  loading?: boolean
}) {
  const gradId = useId().replace(/:/g, '')
  const chartRef = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState<ImpedanceRunRange>('7')
  const [chartKey, setChartKey] = useState(0)
  const [selectedRoute, setSelectedRoute] = useState<ImpedanceRoutePoint | null>(null)
  const [reportOpen, setReportOpen] = useState(false)

  const rangePoints = useMemo(
    () => sliceImpedanceRange(metrics.routePoints, range),
    [metrics.routePoints, range],
  )
  const stats = useMemo(() => computeImpedanceStats(rangePoints), [rangePoints])
  const trend = useMemo(() => computeImpedanceTrend(rangePoints), [rangePoints])
  const chartPoints = useMemo(
    () => enrichChartPoints(downsampleChartPoints(rangePoints), stats),
    [rangePoints, stats],
  )
  const yDomain = useMemo(() => getImpedanceYDomain(chartPoints), [chartPoints])
  const animatedCurrent = useAnimatedOhm(trend.currentImpedance)
  const lastIndex = Math.max(chartPoints.length - 1, 0)
  const trendUp = trend.direction === 'increasing'
  const trendDown = trend.direction === 'decreasing'

  useEffect(() => {
    setChartKey((key) => key + 1)
  }, [range, metrics.routePoints.length])

  const handleExportCsv = () => {
    exportImpedanceCsv(rangePoints, stats, projectName ?? null)
    toast.success('Impedance CSV exported')
  }

  const handleExportPng = async () => {
    if (!chartRef.current) return
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(chartRef.current, { backgroundColor: '#ffffff', scale: 2 })
      const url = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = url
      link.download = `impedance-chart-${projectName ?? 'project'}.png`
      link.click()
      toast.success('Chart exported as PNG')
    } catch {
      toast.error('PNG export unavailable')
    }
  }

  if (loading) {
    return <ImpedanceSkeleton />
  }

  if (!metrics.hasData) {
    return (
      <article className="metal-routing-viz-card metal-routing-viz-card--impedance metal-routing-impedance-card is-empty">
        <div className="metal-routing-impedance-card__header">
          <span className="metal-routing-impedance-card__icon" aria-hidden>
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <h3 className="metal-routing-impedance-card__title">Total Routing Impedance</h3>
            <p className="metal-routing-impedance-card__empty">No impedance analysis available</p>
          </div>
        </div>
        <p className="metal-routing-impedance-card__empty-hint">
          Complete metal rows and calculations on routes to generate impedance analytics.
        </p>
      </article>
    )
  }

  return (
    <>
      <article className="metal-routing-viz-card metal-routing-viz-card--impedance metal-routing-impedance-card">
        <div className="metal-routing-impedance-card__header">
          <div className="metal-routing-impedance-card__title-block">
            <span className="metal-routing-impedance-card__icon" aria-hidden>
              <Zap className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="metal-routing-impedance-card__title-row">
                <h3 className="metal-routing-impedance-card__title">Total Routing Impedance</h3>
                <Info className="metal-routing-impedance-card__info" aria-label="Per-route impedance analytics" />
              </div>
              <p className="metal-routing-impedance-card__value">
                <motion.span layout>{animatedCurrent.toFixed(2)}</motion.span> Ω
              </p>
              <p className="metal-routing-impedance-card__context">
                Σ route impedance{projectName ? ` · ${projectName}` : ''}
              </p>
              <p className={cn('metal-routing-impedance-card__trend-pill', trendUp && 'is-up', trendDown && 'is-down')}>
                {trendUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : null}
                {trendDown ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
                {!trendUp && !trendDown ? <Minus className="h-3.5 w-3.5" /> : null}
                {trend.changeOhm >= 0 ? '+' : ''}
                {trend.changeOhm.toFixed(2)} Ω ({trend.changePercent >= 0 ? '+' : ''}
                {trend.changePercent}%) vs last run
              </p>
            </div>
          </div>

          <div className="metal-routing-impedance-card__controls">
            <div className="metal-routing-impedance-range-select">
              <Calendar className="h-3.5 w-3.5 text-violet-500" aria-hidden />
              <select
                value={range}
                onChange={(event) => setRange(event.target.value as ImpedanceRunRange)}
                className="metal-routing-impedance-range-select__input"
                aria-label="Impedance analysis time range"
              >
                {IMPEDANCE_RANGE_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-violet-400" aria-hidden />
            </div>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button type="button" className="metal-routing-impedance-card__menu" aria-label="Impedance actions">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="metal-routing-impedance-menu" sideOffset={6} align="end">
                  <DropdownMenu.Item className="metal-routing-impedance-menu__item" onSelect={handleExportCsv}>
                    <Download className="h-4 w-4" /> Export CSV
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className="metal-routing-impedance-menu__item" onSelect={() => void handleExportPng()}>
                    <Image className="h-4 w-4" /> Export PNG
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="metal-routing-impedance-menu__item"
                    onSelect={() => setReportOpen(true)}
                  >
                    <ChevronRight className="h-4 w-4" /> View Full Report
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>

        <div className="metal-routing-impedance-card__chart-wrap" ref={chartRef}>
          <div className="metal-routing-impedance-trend-panel">
            <div className="metal-routing-impedance-trend-panel__head">
              <span>Impedance Trend</span>
              {trendUp ? <TrendingUp className="h-3.5 w-3.5" /> : null}
              {trendDown ? <TrendingDown className="h-3.5 w-3.5" /> : null}
            </div>
            <p className={cn('metal-routing-impedance-trend-panel__direction', trendUp && 'is-up', trendDown && 'is-down')}>
              {trend.direction === 'increasing' ? 'Increasing' : trend.direction === 'decreasing' ? 'Decreasing' : 'Stable'}
            </p>
            <p className="metal-routing-impedance-trend-panel__line">
              Previous: {trend.previousImpedance.toFixed(2)} Ω
            </p>
            <p className="metal-routing-impedance-trend-panel__line">
              Current: {trend.currentImpedance.toFixed(2)} Ω
            </p>
            <p className="metal-routing-impedance-trend-panel__change">
              {trend.changeOhm >= 0 ? '+' : ''}
              {trend.changeOhm.toFixed(2)} Ω · {trend.changePercent >= 0 ? '+' : ''}
              {trend.changePercent}%
            </p>
          </div>

          <div className="metal-routing-impedance-card__chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                key={chartKey}
                data={chartPoints}
                margin={{ top: 22, right: 12, left: -8, bottom: chartPoints.length > 15 ? 18 : 0 }}
                onClick={(state: { activePayload?: Array<{ payload: ImpedanceRoutePoint }> }) => {
                  const point = state?.activePayload?.[0]?.payload
                  if (!point) return
                  const fullRoute =
                    rangePoints.find((route) => route.routeId === point.routeId) ?? point
                  setSelectedRoute(fullRoute)
                }}
              >
                <defs>
                  <linearGradient id={`impedanceAnalyticsGrad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.34} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(167, 139, 250, 0.16)" vertical={false} strokeDasharray="4 6" />
                <XAxis
                  dataKey="routeLabel"
                  tick={{ fill: '#a78bfa', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={12}
                  label={{ value: 'Route Segments', position: 'insideBottom', offset: -2, fill: '#a78bfa', fontSize: 10 }}
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fill: '#a78bfa', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={38}
                  tickFormatter={(v: number) => v.toFixed(1)}
                  label={{
                    value: 'Impedance (Ω)',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#a78bfa',
                    fontSize: 10,
                    dx: 8,
                  }}
                />
                <ReferenceLine
                  y={stats.average}
                  stroke="#c4b5fd"
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                />
                <Tooltip content={<ImpedanceTooltip />} cursor={{ stroke: 'rgba(124, 58, 237, 0.35)', strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="impedance"
                  stroke="#a78bfa"
                  strokeWidth={2.5}
                  fill={`url(#impedanceAnalyticsGrad-${gradId})`}
                  animationDuration={350}
                  activeDot={{ r: 5, fill: '#6d28d9', stroke: '#fff', strokeWidth: 2, cursor: 'pointer' }}
                  dot={{ r: 3, fill: '#a78bfa', stroke: '#fff', strokeWidth: 1.5, cursor: 'pointer' }}
                >
                  <LabelList
                    dataKey="impedance"
                    content={(props) => <CurrentPointLabel {...props} lastIndex={lastIndex} />}
                  />
                </Area>
                {chartPoints.length > 15 ? (
                  <Brush dataKey="routeLabel" height={16} stroke="#a78bfa" fill="#f5f3ff" travellerWidth={8} />
                ) : null}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="metal-routing-impedance-card__footer">
          <button type="button" className="metal-routing-impedance-card__report-link" onClick={() => setReportOpen(true)}>
            View full report <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </article>

      <MetalRoutingImpedanceRouteModal
        isOpen={selectedRoute != null}
        onClose={() => setSelectedRoute(null)}
        route={selectedRoute}
      />

      <MetalRoutingImpedanceReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        projectName={projectName ?? null}
        routePoints={rangePoints}
        range={range}
        trend={trend}
      />
    </>
  )
}
