import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Modal } from '@components/ui/Modal'
import type { PdkModule } from '@/types/pdkMetalRouting'
import { cn } from '@/utils/cn'
import { stringToHueColor } from '@/utils/stringColor'

const SIDEBAR_LABEL_MAX = 18
const DEFAULT_LABEL_MAX = 10
const ROW_HEIGHT = 28
const CHART_PAD = 28

type ChartRow = {
  id: string
  label: string
  fullName: string
  metals: number
  color: string
}

type MetalLayerRow = {
  id: string
  label: string
  color: string
}

function buildMetalLayerRows(module: PdkModule): MetalLayerRow[] {
  return module.metals.map((metal, index) => ({
    id: metal._id ?? `${metal.metalType}-${index}`,
    label: metal.metalType,
    color: stringToHueColor(`${module._id}-${metal.metalType}`),
  }))
}

function shortenLabel(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

function buildChartRows(modules: PdkModule[], labelMax: number): ChartRow[] {
  return [...modules]
    .sort((a, b) => b.metals.length - a.metals.length)
    .map((mod) => ({
      id: mod._id,
      label: shortenLabel(mod.name, labelMax),
      fullName: mod.name,
      metals: mod.metals.length,
      color: stringToHueColor(mod._id || mod.name),
    }))
}

function computeYAxisWidth(labels: string[], min = 96, max = 140): number {
  const longest = labels.reduce((maxLen, label) => Math.max(maxLen, label.length), 0)
  return Math.min(max, Math.max(min, longest * 6.4 + 10))
}

function chartHeight(rowCount: number, expanded?: boolean): number {
  return rowCount * (expanded ? 32 : ROW_HEIGHT) + CHART_PAD
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartRow }>
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="metal-routing-analytics-tooltip">
      <p className="font-semibold text-ink">{row.fullName}</p>
      <p className="text-xs text-muted">
        {row.metals} metal type{row.metals === 1 ? '' : 's'}
      </p>
    </div>
  )
}

function YAxisTick({
  x = 0,
  y = 0,
  payload,
  rows,
}: {
  x?: number
  y?: number
  payload?: { value: string }
  rows: ChartRow[]
}) {
  const fullName = rows.find((row) => row.label === payload?.value)?.fullName ?? payload?.value ?? ''
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{fullName}</title>
      <text
        x={-6}
        y={0}
        dy={4}
        textAnchor="end"
        fill="#64748b"
        fontSize={10}
      >
        {payload?.value}
      </text>
    </g>
  )
}

function HorizontalBarChart({
  data,
  expanded,
  yAxisWidth,
}: {
  data: ChartRow[]
  expanded?: boolean
  yAxisWidth: number
}) {
  const height = chartHeight(data.length, expanded)

  return (
    <div className="metal-routing-analytics-chart__canvas" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: expanded ? 16 : 8, left: 0, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.06)" />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: expanded ? 11 : 9, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            height={expanded ? 22 : 18}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={yAxisWidth}
            tick={(props) => <YAxisTick {...props} rows={data} />}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip cursor={{ fill: 'rgba(30, 90, 61, 0.06)' }} content={<ChartTooltip />} />
          <Bar dataKey="metals" radius={[0, 4, 4, 0]} maxBarSize={expanded ? 26 : 14}>
            {data.map((entry) => (
              <Cell key={entry.id} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function DefaultVerticalChart({ data, height }: { data: ChartRow[]; height: number }) {
  return (
    <div className="metal-routing-analytics-chart metal-routing-analytics-chart--sidebar">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(15, 23, 42, 0.06)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={42}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 9, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            width={24}
          />
          <Tooltip cursor={{ fill: 'rgba(30, 90, 61, 0.06)' }} content={<ChartTooltip />} />
          <Bar dataKey="metals" radius={[4, 4, 0, 0]} maxBarSize={22}>
            {data.map((entry) => (
              <Cell key={entry.id} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ModuleMetalLayersPanel({ module }: { module: PdkModule }) {
  const layers = useMemo(() => buildMetalLayerRows(module), [module])

  if (layers.length === 0) {
    return (
      <p className="metal-routing-analytics-empty">No metal types defined for this module.</p>
    )
  }

  return (
    <ul className="metal-routing-analytics-metal-list">
      {layers.map((layer) => (
        <li key={layer.id} className="metal-routing-analytics-metal-list__item">
          <span
            className="metal-routing-analytics-metal-list__bar"
            style={{ backgroundColor: layer.color }}
            aria-hidden
          />
          <span className="metal-routing-analytics-metal-list__name">{layer.label}</span>
        </li>
      ))}
    </ul>
  )
}

function MetalsPerModuleModal({
  isOpen,
  onClose,
  rows,
}: {
  isOpen: boolean
  onClose: () => void
  rows: ChartRow[]
}) {
  const yAxisWidth = computeYAxisWidth(rows.map((row) => row.fullName), 140, 220)

  return (
    <Modal isOpen={isOpen} title="Metal types per module" onClose={onClose} size="xl">
      <p className="metal-routing-analytics-modal-desc">
        {rows.length} module{rows.length === 1 ? '' : 's'} sorted by metal layer count. Hover a bar for details.
      </p>
      <div className="metal-routing-analytics-chart metal-routing-analytics-chart--modal">
        <HorizontalBarChart data={rows} expanded yAxisWidth={yAxisWidth} />
      </div>
      <ul className="metal-routing-analytics-modal-list">
        {rows.map((row) => (
          <li key={row.id} className="metal-routing-analytics-modal-list__item">
            <span
              className="metal-routing-analytics-modal-list__swatch"
              style={{ backgroundColor: row.color }}
              aria-hidden
            />
            <span className="metal-routing-analytics-modal-list__name">{row.fullName}</span>
            <span className="metal-routing-analytics-modal-list__value">
              {row.metals} metal{row.metals === 1 ? '' : 's'}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

export function PdkModulesAnalyticsChart({
  modules,
  loading,
  sidebar,
  fill,
  emptyMessage,
}: {
  modules: PdkModule[]
  loading?: boolean
  sidebar?: boolean
  fill?: boolean
  emptyMessage?: string
}) {
  const [viewAllOpen, setViewAllOpen] = useState(false)

  const sidebarRows = useMemo(
    () => buildChartRows(modules, SIDEBAR_LABEL_MAX),
    [modules],
  )

  const modalRows = useMemo(
    () =>
      buildChartRows(modules, 999).map((row) => ({
        ...row,
        label: row.fullName,
      })),
    [modules],
  )

  const defaultRows = useMemo(
    () => buildChartRows(modules, DEFAULT_LABEL_MAX).slice(0, 6),
    [modules],
  )

  const sidebarYAxisWidth = useMemo(
    () => computeYAxisWidth(sidebarRows.map((row) => row.label)),
    [sidebarRows],
  )

  const hasTruncatedLabels = sidebarRows.some((row) => row.label !== row.fullName)
  const singleModule = sidebar && modules.length === 1 ? modules[0] : null

  if (loading) {
    return (
      <div
        className={cn(
          'metal-routing-analytics-card metal-routing-analytics-card--loading',
          sidebar && 'metal-routing-analytics-card--sidebar',
          sidebar && fill && 'metal-routing-analytics-card--sidebar-fill',
        )}
        aria-hidden
      >
        <div
          className={cn(
            'metal-routing-skeleton metal-routing-analytics-skeleton metal-routing-analytics-skeleton--compact',
            sidebar && !fill && 'metal-routing-analytics-skeleton--sidebar-horizontal',
            sidebar && fill && 'metal-routing-analytics-skeleton--sidebar-fill',
          )}
        />
      </div>
    )
  }

  if (modules.length === 0) {
    return (
      <article
        className={cn(
          'metal-routing-analytics-card metal-routing-analytics-card--compact',
          sidebar && 'metal-routing-analytics-card--sidebar',
        )}
      >
        <h3 className="metal-routing-analytics-title">Metal types per module</h3>
        <p className="metal-routing-analytics-empty">
          {emptyMessage ?? 'Add modules to see distribution.'}
        </p>
      </article>
    )
  }

  return (
    <>
      <article
        className={cn(
          'metal-routing-analytics-card metal-routing-analytics-card--compact',
          sidebar && 'metal-routing-analytics-card--sidebar',
          sidebar && fill && 'metal-routing-analytics-card--sidebar-fill',
        )}
      >
        <div className="metal-routing-analytics-card__header">
          <div className="min-w-0">
            <h3 className="metal-routing-analytics-title">
              {singleModule ? 'Metal Types' : 'Metal types per module'}
            </h3>
            {sidebar ? (
              <p className="metal-routing-analytics-subtitle">
                {singleModule
                  ? `${singleModule.metals.length} type${singleModule.metals.length === 1 ? '' : 's'}`
                  : `${modules.length} module${modules.length === 1 ? '' : 's'}${modules.length > 4 ? ' · scroll for more' : ''}`}
              </p>
            ) : null}
          </div>
          {sidebar && modules.length > 1 ? (
            <button
              type="button"
              className="metal-routing-analytics-view-all"
              onClick={() => setViewAllOpen(true)}
            >
              View all
            </button>
          ) : null}
        </div>

        {singleModule ? (
          <div
            className={cn(
              'metal-routing-analytics-metal-list-wrap',
              fill && 'is-fill',
            )}
          >
            <ModuleMetalLayersPanel module={singleModule} />
          </div>
        ) : sidebar ? (
          <div
            className={cn(
              'metal-routing-analytics-chart metal-routing-analytics-chart--sidebar-horizontal',
              'metal-routing-analytics-chart--scroll',
              fill && 'is-fill',
            )}
            tabIndex={0}
            role="region"
            aria-label="Metal types per module chart. Scroll to see all modules."
          >
            <HorizontalBarChart data={sidebarRows} yAxisWidth={sidebarYAxisWidth} />
          </div>
        ) : (
          <DefaultVerticalChart data={defaultRows} height={150} />
        )}

        {sidebar && !singleModule && hasTruncatedLabels ? (
          <p className="metal-routing-analytics-hint">Hover labels or open View all for full names.</p>
        ) : null}
      </article>

      {sidebar ? (
        <MetalsPerModuleModal
          isOpen={viewAllOpen}
          onClose={() => setViewAllOpen(false)}
          rows={modalRows}
        />
      ) : null}
    </>
  )
}
