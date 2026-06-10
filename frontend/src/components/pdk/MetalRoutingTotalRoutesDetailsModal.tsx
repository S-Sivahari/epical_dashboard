import { ArrowDownRight, ArrowUpRight, Route } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Modal } from '@components/ui/Modal'
import type { ProjectRouteMetrics, RouteTrendRange } from '@/types/pdkMetalRouting'
import { formatRelativeRouteTime, getRouteTrendYDomain, getTrendForRange } from '@/utils/metalRoutingMetricsVisual'
import { cn } from '@/utils/cn'

const RANGE_OPTIONS: { key: RouteTrendRange; label: string }[] = [
  { key: '7', label: '7D' },
  { key: '30', label: '30D' },
  { key: '90', label: '90D' },
]

function BreakdownList({
  title,
  items,
  emptyLabel,
}: {
  title: string
  items: { name: string; count: number }[]
  emptyLabel: string
}) {
  const max = Math.max(...items.map((item) => item.count), 1)

  return (
    <div className="metal-routing-routes-detail__panel">
      <h4 className="metal-routing-routes-detail__panel-title">{title}</h4>
      {items.length === 0 ? (
        <p className="metal-routing-routes-detail__empty">{emptyLabel}</p>
      ) : (
        <ul className="metal-routing-routes-detail__breakdown">
          {items.map((item) => (
            <li key={item.name} className="metal-routing-routes-detail__breakdown-row">
              <div className="metal-routing-routes-detail__breakdown-meta">
                <span className="metal-routing-routes-detail__breakdown-name">{item.name}</span>
                <span className="metal-routing-routes-detail__breakdown-count">{item.count}</span>
              </div>
              <div className="metal-routing-routes-detail__breakdown-bar">
                <span
                  className="metal-routing-routes-detail__breakdown-fill"
                  style={{ width: `${(item.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function MetalRoutingTotalRoutesDetailsModal({
  isOpen,
  onClose,
  metrics,
  projectName,
  range,
  onRangeChange,
}: {
  isOpen: boolean
  onClose: () => void
  metrics: ProjectRouteMetrics
  projectName: string | null
  range: RouteTrendRange
  onRangeChange: (range: RouteTrendRange) => void
}) {
  const chartData = metrics.trendsByRange[range]
  const yDomain = getRouteTrendYDomain(chartData)
  const trend = getTrendForRange(chartData, range)
  const isUp = trend.delta >= 0

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Route Activity Analytics" size="xl">
      <div className="metal-routing-routes-detail">
        <div className="metal-routing-routes-detail__summary">
          <div>
            <p className="metal-routing-routes-detail__eyebrow">
              {projectName ? `${projectName} · ` : ''}Total Routes
            </p>
            <p className="metal-routing-routes-detail__total">{metrics.totalRoutes.toLocaleString()}</p>
            <p className={cn('metal-routing-routes-detail__trend', isUp ? 'is-up' : 'is-down')}>
              {isUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {isUp ? '+' : ''}
              {trend.delta} {trend.periodLabel} · {isUp ? '+' : ''}
              {trend.growthPercent}%
            </p>
          </div>
          <div className="metal-routing-routes-detail__range">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={cn(
                  'metal-routing-routes-range-btn',
                  range === option.key && 'is-active',
                )}
                onClick={() => onRangeChange(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="metal-routing-routes-detail__chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="routeDetailGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" vertical={false} strokeDasharray="4 5" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                domain={yDomain}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={42}
                tickFormatter={(v: number) => v.toLocaleString()}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(37, 99, 235, 0.2)', strokeWidth: 1 }}
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                  fontSize: 12,
                }}
                formatter={(value: number, _name, item) => {
                  const added = (item?.payload as { added?: number })?.added ?? 0
                  return [`${value.toLocaleString()} total (+${added} new)`, 'Routes']
                }}
                labelFormatter={(label) => String(label)}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#2563eb"
                strokeWidth={2}
                fill="url(#routeDetailGrad)"
                animationDuration={350}
                dot={false}
                activeDot={{ r: 4, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="metal-routing-routes-detail__grid">
          <BreakdownList
            title="Routes by Library"
            items={metrics.routesByLibrary}
            emptyLabel="No library-linked routes yet."
          />
          <BreakdownList
            title="Routes by Cell"
            items={metrics.routesByCell}
            emptyLabel="No cell activity recorded yet."
          />
        </div>

        <div className="metal-routing-routes-detail__panel">
          <h4 className="metal-routing-routes-detail__panel-title">Recent Route Additions</h4>
          {metrics.recentAdditions.length === 0 ? (
            <p className="metal-routing-routes-detail__empty">No routes have been added yet.</p>
          ) : (
            <ul className="metal-routing-routes-detail__recent">
              {metrics.recentAdditions.map((route) => (
                <li key={route.id} className="metal-routing-routes-detail__recent-row">
                  <span className="metal-routing-routes-detail__recent-icon" aria-hidden>
                    <Route className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="metal-routing-routes-detail__recent-label">
                      {route.fromCell} → {route.toCell}
                    </p>
                    <p className="metal-routing-routes-detail__recent-sub">
                      {route.fromSignal} → {route.toSignal}
                      {route.libraryName ? ` · ${route.libraryName}` : ''}
                    </p>
                  </div>
                  <span className="metal-routing-routes-detail__recent-time">
                    {formatRelativeRouteTime(route.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}
