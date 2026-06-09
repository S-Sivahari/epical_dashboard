import { AlertTriangle, Gauge, Zap } from 'lucide-react'
import type { AnalysisSummary, MetalEntry } from '@/types/pkaMetalRouting'
import { cn } from '@/utils/cn'

function formatNum(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4) : '—'
}

export function MetalRoutingInsights({
  metals,
  summary,
  minCapacityMetalId,
  highestImpedanceMetalId,
}: {
  metals: MetalEntry[]
  summary: AnalysisSummary | null
  minCapacityMetalId?: string | null
  highestImpedanceMetalId?: string | null
}) {
  if (!summary || metals.length === 0) return null

  const minMetal =
    minCapacityMetalId != null
      ? metals.find((m) => m._id === minCapacityMetalId)
      : summary.minCapacityMetalIndex >= 0
        ? metals[summary.minCapacityMetalIndex]
        : null

  const maxImpMetal =
    highestImpedanceMetalId != null
      ? metals.find((m) => m._id === highestImpedanceMetalId)
      : summary.highestImpedanceMetalIndex >= 0
        ? metals[summary.highestImpedanceMetalIndex]
        : null

  return (
    <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-4 ring-1 ring-amber-100">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-700" />
        <h3 className="text-sm font-semibold text-amber-900">Routing Insights</h3>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <InsightCard
          icon={Gauge}
          title="Minimum Current Capacity Bearing Metal"
          accent="amber"
          metal={minMetal}
          metricLabel="Implemented Current Metal Capacity"
          metricValue={formatNum(summary.minimumMetalCurrentCapacity)}
          flag="Lowest capacity — potential bottleneck"
        />
        <InsightCard
          icon={Zap}
          title="Highest Routing Metal Impedance"
          accent="orange"
          metal={maxImpMetal}
          metricLabel="Routing Metal Impedance"
          metricValue={formatNum(maxImpMetal?.routingMetalImpedance ?? 0)}
          flag="Highest impedance — review routing"
        />
      </div>

      <p className="mt-3 text-xs text-amber-800/80">
        Total impedance across all metals: <strong>{formatNum(summary.totalImpedance)}</strong>
      </p>
    </div>
  )
}

function InsightCard({
  icon: Icon,
  title,
  accent,
  metal,
  metricLabel,
  metricValue,
  flag,
}: {
  icon: typeof Gauge
  title: string
  accent: 'amber' | 'orange'
  metal: MetalEntry | null | undefined
  metricLabel: string
  metricValue: string
  flag: string
}) {
  const border =
    accent === 'amber' ? 'border-amber-200 bg-white/80' : 'border-orange-200 bg-white/80'
  const iconColor = accent === 'amber' ? 'text-amber-700' : 'text-orange-700'

  return (
    <div className={cn('rounded-lg border p-3', border)}>
      <div className="mb-2 flex items-start gap-2">
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconColor)} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
          {metal ? (
            <p className="mt-1 text-sm font-medium text-ink">
              {metal.metalName}{' '}
              <span className="font-normal text-muted">({metal.pkaModuleName})</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">—</p>
          )}
        </div>
      </div>
      <dl className="space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Width × Length</dt>
          <dd className="font-medium text-ink">
            {metal ? `${metal.width} × ${metal.length}` : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">{metricLabel}</dt>
          <dd className="font-semibold text-ink">{metricValue}</dd>
        </div>
      </dl>
      <p className={cn('mt-2 text-[11px] font-medium', iconColor)}>{flag}</p>
    </div>
  )
}
