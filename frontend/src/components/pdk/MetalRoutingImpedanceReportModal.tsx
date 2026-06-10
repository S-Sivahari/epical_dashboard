import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  AreaChart as AreaChartIcon,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  LineChart as LineChartIcon,
  Maximize2,
  Minimize2,
  Printer,
  Search,
  Sigma,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  ImpedanceRoutePoint,
  ImpedanceRunRange,
  ImpedanceTrendIntel,
} from '@/types/pdkMetalRouting'
import {
  IMPEDANCE_RANGE_OPTIONS,
  buildRouteAnalysisRows,
  buildStructuredInsights,
  computeImpedanceStats,
  enrichReportChartPoints,
  exportImpedanceCsv,
  exportImpedanceExcel,
  exportImpedancePdf,
  generateExecutiveSummary,
  getAverageImpedanceStatus,
  getImpedanceYDomain,
} from '@/utils/metalRoutingImpedanceVisual'
import { cn } from '@/utils/cn'

type ChartMode = 'area' | 'line'
type SortKey = 'routeLabel' | 'impedance' | 'vsAverage' | 'changePercent' | 'rank'
type SortDir = 'asc' | 'desc'
type RouteFilter = 'all' | 'above' | 'below' | 'top'

function ReportChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{
    payload: ImpedanceRoutePoint & {
      deltaFromAverage: number
      percentFromAverage: number
      rank: number
    }
  }>
}) {
  if (!active || !payload?.[0]) return null
  const point = payload[0].payload
  return (
    <div className="impedance-report-tooltip">
      <p className="impedance-report-tooltip__title">{point.routeLabel} · {point.routeName}</p>
      <p><strong>{point.impedance.toFixed(2)} Ω</strong></p>
      <p>vs avg: {point.deltaFromAverage >= 0 ? '+' : ''}{point.deltaFromAverage.toFixed(2)} Ω</p>
      <p>Rank: #{point.rank}</p>
    </div>
  )
}

function InsightIcon({ tone }: { tone: 'success' | 'warning' | 'info' }) {
  if (tone === 'warning') return <AlertTriangle className="h-4 w-4" aria-hidden />
  return <CheckCircle2 className="h-4 w-4" aria-hidden />
}

export function MetalRoutingImpedanceReportModal({
  isOpen,
  onClose,
  projectName,
  routePoints,
  range,
  trend,
}: {
  isOpen: boolean
  onClose: () => void
  projectName: string | null
  routePoints: ImpedanceRoutePoint[]
  range: ImpedanceRunRange
  trend: ImpedanceTrendIntel
}) {
  const gradId = useId().replace(/:/g, '')
  const reportRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const [chartMode, setChartMode] = useState<ChartMode>('area')
  const [chartFullscreen, setChartFullscreen] = useState(false)
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [routeFilter, setRouteFilter] = useState<RouteFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [analysisTimestamp] = useState(() => new Date().toLocaleString())

  const stats = useMemo(() => computeImpedanceStats(routePoints), [routePoints])
  const tableRows = useMemo(() => buildRouteAnalysisRows(routePoints, stats), [routePoints, stats])
  const chartData = useMemo(
    () => enrichReportChartPoints(routePoints, stats, tableRows),
    [routePoints, stats, tableRows],
  )
  const yDomain = useMemo(() => getImpedanceYDomain(chartData), [chartData])
  const insights = useMemo(() => buildStructuredInsights(routePoints, stats), [routePoints, stats])
  const summary = useMemo(() => generateExecutiveSummary(routePoints, stats), [routePoints, stats])
  const avgStatus = useMemo(() => getAverageImpedanceStatus(stats), [stats])
  const rangeLabel = IMPEDANCE_RANGE_OPTIONS.find((o) => o.key === range)?.label ?? 'All Runs'

  const selectedRoute = useMemo(
    () => routePoints.find((p) => p.routeId === selectedRouteId) ?? routePoints[routePoints.length - 1] ?? null,
    [routePoints, selectedRouteId],
  )

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    let rows = tableRows
    if (routeFilter === 'above') {
      rows = rows.filter((row) => row.impedance > stats.average)
    } else if (routeFilter === 'below') {
      rows = rows.filter((row) => row.impedance < stats.average)
    } else if (routeFilter === 'top') {
      rows = rows.filter((row) => row.rank <= 3)
    }
    if (query) {
      rows = rows.filter(
        (row) =>
          row.routeLabel.toLowerCase().includes(query) ||
          row.routeName.toLowerCase().includes(query) ||
          row.signalPath.toLowerCase().includes(query),
      )
    }
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av)
    })
    return rows
  }, [tableRows, search, routeFilter, sortKey, sortDir, stats.average])

  useEffect(() => {
    if (!isOpen) return
    const last = routePoints[routePoints.length - 1]
    if (last) setSelectedRouteId(last.routeId)
  }, [isOpen, routePoints])

  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'routeLabel' ? 'asc' : 'desc')
    }
  }

  const handleExportChartPng = async () => {
    if (!chartRef.current) return
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(chartRef.current, { backgroundColor: '#ffffff', scale: 2 })
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = `impedance-trend-${projectName ?? 'project'}.png`
      link.click()
      toast.success('Chart exported')
    } catch {
      toast.error('Chart export failed')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (!isOpen) return null

  const chartMargin = { top: 12, right: 16, left: 4, bottom: chartData.length > 12 ? 22 : 8 }
  const handleChartClick = (state: { activePayload?: Array<{ payload: ImpedanceRoutePoint }> }) => {
    const point = state?.activePayload?.[0]?.payload
    if (point) setSelectedRouteId(point.routeId)
  }
  const chartSeries =
    chartMode === 'area' ? (
      <Area
        type="monotone"
        dataKey="impedance"
        stroke="#7c3aed"
        strokeWidth={2.5}
        fill={`url(#reportGrad-${gradId})`}
        dot={{ r: 4, fill: '#7c3aed', stroke: '#fff', strokeWidth: 2, cursor: 'pointer' }}
        activeDot={{ r: 6, fill: '#6d28d9' }}
        animationDuration={350}
      />
    ) : (
      <Line
        type="monotone"
        dataKey="impedance"
        stroke="#7c3aed"
        strokeWidth={2.5}
        dot={{ r: 4, fill: '#7c3aed', stroke: '#fff', strokeWidth: 2, cursor: 'pointer' }}
        activeDot={{ r: 6, fill: '#6d28d9' }}
        animationDuration={350}
      />
    )
  const chartBody = (
    <>
      <defs>
        <linearGradient id={`reportGrad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.32} />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <CartesianGrid stroke="rgba(167, 139, 250, 0.16)" vertical={false} strokeDasharray="4 6" />
      <XAxis dataKey="routeLabel" tick={{ fill: '#8b5cf6', fontSize: 11 }} axisLine={false} tickLine={false} />
      <YAxis
        domain={yDomain}
        tick={{ fill: '#8b5cf6', fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        width={44}
        tickFormatter={(v: number) => v.toFixed(1)}
      />
      <Tooltip content={<ReportChartTooltip />} cursor={{ stroke: 'rgba(124, 58, 237, 0.35)', strokeWidth: 1 }} />
      {chartSeries}
      {chartData.length > 12 ? (
        <Brush dataKey="routeLabel" height={18} stroke="#a78bfa" fill="#f5f3ff" travellerWidth={10} />
      ) : null}
    </>
  )

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="impedance-report-overlay" />
        <Dialog.Content className="impedance-report-shell" aria-describedby={undefined}>
          <div className="impedance-report" ref={reportRef} id="impedance-analysis-report">
            <header className="impedance-report__header">
              <div className="impedance-report__header-main">
                <Dialog.Title className="impedance-report__title">Impedance Analysis Report</Dialog.Title>
                <div className="impedance-report__meta">
                  <span>Project: <strong>{projectName ?? '—'}</strong></span>
                  <span>Measured Routes: <strong>{stats.measuredRouteCount}</strong></span>
                  <span>Window: <strong>{rangeLabel}</strong></span>
                  <span>Analysis: <strong>{analysisTimestamp}</strong></span>
                </div>
              </div>
              <div className="impedance-report__header-actions">
                <button type="button" className="impedance-report__action" onClick={() => exportImpedanceCsv(routePoints, stats, projectName)}>
                  <Download className="h-4 w-4" /> CSV
                </button>
                <button
                  type="button"
                  className="impedance-report__action"
                  onClick={() => {
                    void exportImpedanceExcel(tableRows, stats, projectName).then(() => toast.success('Excel exported'))
                  }}
                >
                  <FileSpreadsheet className="h-4 w-4" /> Excel
                </button>
                <button
                  type="button"
                  className="impedance-report__action"
                  onClick={() => {
                    exportImpedancePdf(tableRows, stats, projectName, summary)
                    toast.success('PDF exported')
                  }}
                >
                  <FileText className="h-4 w-4" /> PDF
                </button>
                <button type="button" className="impedance-report__action" onClick={handlePrint}>
                  <Printer className="h-4 w-4" /> Print
                </button>
                <Dialog.Close className="impedance-report__close" aria-label="Close report">
                  <X className="h-5 w-5" />
                </Dialog.Close>
              </div>
            </header>

            <div className="impedance-report__body">
              <section className="impedance-report__kpis">
                <article className="impedance-report-kpi">
                  <TrendingUp className="impedance-report-kpi__icon is-violet" aria-hidden />
                  <div>
                    <p className="impedance-report-kpi__label">Average Impedance</p>
                    <p className="impedance-report-kpi__value">{stats.average.toFixed(2)} Ω</p>
                    <span className={cn('impedance-report-kpi__status', `is-${avgStatus.tone}`)}>
                      Status: {avgStatus.label}
                    </span>
                  </div>
                </article>
                <article className="impedance-report-kpi">
                  <TrendingDown className="impedance-report-kpi__icon is-green" aria-hidden />
                  <div>
                    <p className="impedance-report-kpi__label">Minimum Impedance</p>
                    <p className="impedance-report-kpi__value">{stats.min.toFixed(2)} Ω</p>
                    <span className="impedance-report-kpi__sub">Route {stats.minRouteLabel}</span>
                  </div>
                </article>
                <article className="impedance-report-kpi">
                  <TrendingUp className="impedance-report-kpi__icon is-red" aria-hidden />
                  <div>
                    <p className="impedance-report-kpi__label">Maximum Impedance</p>
                    <p className="impedance-report-kpi__value">{stats.max.toFixed(2)} Ω</p>
                    <span className="impedance-report-kpi__sub">Route {stats.maxRouteLabel}</span>
                  </div>
                </article>
                <article className="impedance-report-kpi">
                  <Sigma className="impedance-report-kpi__icon is-blue" aria-hidden />
                  <div>
                    <p className="impedance-report-kpi__label">Total Impedance</p>
                    <p className="impedance-report-kpi__value">{stats.total.toFixed(2)} Ω</p>
                    <span className="impedance-report-kpi__sub">
                      Across {stats.measuredRouteCount} route{stats.measuredRouteCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </article>
              </section>

              <section className={cn('impedance-report__main-grid', chartFullscreen && 'is-chart-fullscreen')}>
                <div className={cn('impedance-report__chart-panel', chartFullscreen && 'is-fullscreen')}>
                  <div className="impedance-report__panel-head">
                    <h2>Impedance Trend</h2>
                    <div className="impedance-report__chart-tools">
                      <button
                        type="button"
                        className={cn('impedance-report__tool', chartMode === 'area' && 'is-active')}
                        onClick={() => setChartMode('area')}
                      >
                        <AreaChartIcon className="h-3.5 w-3.5" /> Area
                      </button>
                      <button
                        type="button"
                        className={cn('impedance-report__tool', chartMode === 'line' && 'is-active')}
                        onClick={() => setChartMode('line')}
                      >
                        <LineChartIcon className="h-3.5 w-3.5" /> Line
                      </button>
                      <button type="button" className="impedance-report__tool" onClick={() => void handleExportChartPng()}>
                        <Download className="h-3.5 w-3.5" /> Export
                      </button>
                      <button
                        type="button"
                        className="impedance-report__tool"
                        onClick={() => setChartFullscreen((v) => !v)}
                      >
                        {chartFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                        {chartFullscreen ? 'Exit' : 'Fullscreen'}
                      </button>
                    </div>
                  </div>
                  <div className="impedance-report__chart" ref={chartRef}>
                    <ResponsiveContainer width="100%" height="100%">
                      {chartMode === 'area' ? (
                        <AreaChart data={chartData} margin={chartMargin} onClick={handleChartClick}>
                          {chartBody}
                        </AreaChart>
                      ) : (
                        <LineChart data={chartData} margin={chartMargin} onClick={handleChartClick}>
                          {chartBody}
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                  <p className="impedance-report__trend-note">
                    Run trend: {trend.direction} · {trend.changeOhm >= 0 ? '+' : ''}{trend.changeOhm.toFixed(2)} Ω ({trend.changePercent}%)
                  </p>
                </div>

                <aside className="impedance-report__side-panels">
                  <div className="impedance-report__insights-panel">
                    <h3>Analysis Insights</h3>
                    <ul className="impedance-report__insights-list">
                      {insights.map((item) => (
                        <li key={item.message} className={cn('impedance-report__insight', `is-${item.tone}`)}>
                          <InsightIcon tone={item.tone} />
                          <span>{item.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="impedance-report__breakdown-panel">
                    <h3>Route Breakdown</h3>
                    {selectedRoute ? (
                      <>
                        <p className="impedance-report__breakdown-title">Route {selectedRoute.routeLabel}</p>
                        <p className="impedance-report__breakdown-path">{selectedRoute.routeName}</p>
                        <ul className="impedance-report__layers">
                          {selectedRoute.layerContributions.map((layer) => (
                            <li key={`${selectedRoute.routeId}-${layer.metalType}`}>
                              <span>{layer.metalType}</span>
                              <span>{layer.impedance.toFixed(2)} Ω</span>
                            </li>
                          ))}
                        </ul>
                        <p className="impedance-report__breakdown-total">
                          Total: <strong>{selectedRoute.impedance.toFixed(2)} Ω</strong>
                        </p>
                      </>
                    ) : (
                      <p className="impedance-report__empty">Select a route from the chart or table.</p>
                    )}
                  </div>
                </aside>
              </section>

              <section className="impedance-report__table-section">
                <div className="impedance-report__panel-head">
                  <h2>Route Analysis Table</h2>
                  <div className="impedance-report__table-tools">
                    <select
                      className="impedance-report__filter"
                      value={routeFilter}
                      onChange={(e) => setRouteFilter(e.target.value as RouteFilter)}
                      aria-label="Filter routes"
                    >
                      <option value="all">All routes</option>
                      <option value="above">Above average</option>
                      <option value="below">Below average</option>
                      <option value="top">Top 3 rank</option>
                    </select>
                    <label className="impedance-report__search">
                      <Search className="h-4 w-4" aria-hidden />
                      <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search routes..."
                        aria-label="Search routes"
                      />
                    </label>
                    <button type="button" className="impedance-report__tool" onClick={() => exportImpedanceCsv(filteredRows, stats, projectName)}>
                      Export
                    </button>
                  </div>
                </div>
                <div className="impedance-report__table-wrap">
                  <table className="impedance-report__table">
                    <thead>
                      <tr>
                        {([
                          ['routeLabel', 'Route'],
                          ['impedance', 'Impedance'],
                          ['vsAverage', 'Vs Average'],
                          ['changePercent', 'Change %'],
                          ['rank', 'Rank'],
                        ] as [SortKey, string][]).map(([key, label]) => (
                          <th key={key}>
                            <button type="button" onClick={() => toggleSort(key)}>
                              {label} {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                            </button>
                          </th>
                        ))}
                        <th>Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => (
                        <tr
                          key={row.routeId}
                          className={cn(row.routeId === selectedRouteId && 'is-selected')}
                          onClick={() => setSelectedRouteId(row.routeId)}
                        >
                          <td>{row.routeLabel}</td>
                          <td>{row.impedance.toFixed(2)} Ω</td>
                          <td>{row.vsAverage >= 0 ? '+' : ''}{row.vsAverage.toFixed(2)} Ω</td>
                          <td>{row.changePercent >= 0 ? '+' : ''}{row.changePercent}%</td>
                          <td>#{row.rank}</td>
                          <td>
                            <span className={cn('impedance-report__trend-pill', `is-${row.trendDirection}`)}>
                              {row.trendDirection}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="impedance-report__summary">
                <h2>Analysis Summary</h2>
                {summary.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </section>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
