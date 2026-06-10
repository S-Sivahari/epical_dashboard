import {
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Layers,
  LayoutGrid,
  User,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  aggregateWorkspaceStats,
  buildCellEffortChartData,
  buildGroupedOverviewChartData,
  OVERVIEW_CHART_SERIES,
  shouldUseCellEffortChart,
} from './projectAnalyticsUtils'

const SUMMARY_ICONS = {
  Projects: Briefcase,
  'Total cells': Layers,
  Yours: User,
  'Est. effort': Clock3,
  Reviews: ClipboardCheck,
  Complete: CheckCircle2,
  'In progress': LayoutGrid,
  'Not started': Layers,
}

function ChartCard({ title, subtitle, children }) {
  return (
    <section className="emp-wf-analytics-card emp-wf-analytics-card--wide">
      <header className="emp-wf-analytics-card-head">
        <h3 className="emp-wf-section-eyebrow">{title}</h3>
        {subtitle ? <p className="emp-wf-analytics-card-sub">{subtitle}</p> : null}
      </header>
      <div className="emp-wf-analytics-card-body">{children}</div>
    </section>
  )
}

function EmptyChart({ message }) {
  return <p className="emp-wf-analytics-empty">{message}</p>
}

function GroupedOverviewTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const items = payload.filter((entry) => Number(entry.value) > 0)
  if (!items.length) return null

  return (
    <div className="emp-wf-analytics-tooltip">
      <strong>{label}</strong>
      {items.map((entry) => (
        <span key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
          {entry.dataKey === 'totalEffort' || entry.dataKey === 'yourEffort' ? 'h' : ''}
        </span>
      ))}
    </div>
  )
}

function CellEffortTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0]?.payload
  if (!item) return null
  return (
    <div className="emp-wf-analytics-tooltip">
      <strong>{item.fullName}</strong>
      <span>{item.effort}h estimated</span>
      {item.pendingReview ? <span>Review pending ({item.pendingReview})</span> : null}
      {item.isAssignedToMe ? <span>Assigned to you</span> : null}
    </div>
  )
}

const CELL_CHART_LEGEND = [
  { label: 'Review pending', color: '#d97706' },
  { label: 'Completed', color: '#16a34a' },
  { label: 'In progress', color: '#f59e0b' },
  { label: 'Not started', color: '#94a3b8' },
]

export function EmployeeProjectAnalyticsPanel({ workspaces = [], showPortfolioSummary = false }) {
  const allCells = workspaces.flatMap((ws) => ws?.cells || [])
  const portfolio = aggregateWorkspaceStats(workspaces)
  const useCellChart = shouldUseCellEffortChart(workspaces)
  const groupedData = buildGroupedOverviewChartData(allCells)
  const cellEffortData = buildCellEffortChartData(allCells)
  const hasCells = allCells.length > 0

  const chartTitle = useCellChart ? 'Cell effort & reviews' : 'Workload overview'
  const chartSubtitle = useCellChart
    ? 'Estimated hours per cell · color indicates status or pending review'
    : 'Grouped view of effort hours, cell status, and review workload'

  const summaryItems = [
    { label: 'Projects', value: portfolio.projects },
    { label: 'Total cells', value: portfolio.cells },
    { label: 'Yours', value: portfolio.yours },
    { label: 'Est. effort', value: `${portfolio.effort}h`, accent: true },
    { label: 'Reviews', value: portfolio.reviews },
    { label: 'Complete', value: portfolio.complete },
    { label: 'In progress', value: portfolio.inProgress },
    { label: 'Not started', value: portfolio.notStarted },
  ]

  return (
    <div className="emp-wf-analytics">
      {showPortfolioSummary ? (
        <div className="emp-wf-analytics-summary">
          {summaryItems.map(({ label, value, accent }) => {
            const Icon = SUMMARY_ICONS[label]
            return (
              <div
                key={label}
                className={`emp-wf-analytics-summary-item${accent ? ' emp-wf-analytics-summary-item--accent' : ''}`}
              >
                {Icon ? (
                  <span className="emp-wf-analytics-summary-icon" aria-hidden>
                    <Icon className="h-4 w-4" />
                  </span>
                ) : null}
                <div className="emp-wf-analytics-summary-copy">
                  <span className="emp-wf-analytics-summary-label">{label}</span>
                  <strong className="emp-wf-analytics-summary-value">{value}</strong>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      {showPortfolioSummary ? (
        <div className="emp-wf-analytics-section-divider" aria-hidden>
          <span className="emp-wf-section-eyebrow">Workload overview</span>
        </div>
      ) : null}

      <ChartCard title={chartTitle} subtitle={chartSubtitle}>
        {!hasCells ? (
          <EmptyChart message="No cell data yet." />
        ) : useCellChart ? (
          <>
            <div className="emp-wf-chart-legend emp-wf-chart-legend--inline" aria-label="Chart legend">
              {CELL_CHART_LEGEND.map(({ label, color }) => (
                <span key={label} className="emp-wf-chart-legend-item">
                  <span className="emp-wf-chart-legend-swatch" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={Math.max(280, cellEffortData.length * 40)}>
              <BarChart
                data={cellEffortData}
                layout="vertical"
                margin={{ top: 12, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }}>
                  <Label value="Estimated hours" position="insideBottom" offset={-4} style={{ fontSize: 11, fill: '#64748b' }} />
                </XAxis>
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#334155' }} width={112}>
                  <Label value="Cells" angle={-90} position="insideLeft" style={{ fontSize: 11, fill: '#64748b' }} />
                </YAxis>
                <Tooltip content={<CellEffortTooltip />} cursor={{ fill: 'rgba(37, 99, 235, 0.06)' }} />
                <Bar dataKey="effort" name="Estimated effort" radius={[0, 6, 6, 0]} maxBarSize={28}>
                  {cellEffortData.map((entry) => (
                    <Cell key={entry.id} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={groupedData} margin={{ top: 12, right: 16, left: 4, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#334155' }} tickLine={false}>
                <Label value="Workload category" position="insideBottom" offset={-8} style={{ fontSize: 11, fill: '#64748b' }} />
              </XAxis>
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} width={40}>
                <Label value="Hours / count" angle={-90} position="insideLeft" style={{ fontSize: 11, fill: '#64748b' }} />
              </YAxis>
              <Tooltip content={<GroupedOverviewTooltip />} cursor={{ fill: 'rgba(37, 99, 235, 0.06)' }} />
              <Legend
                verticalAlign="top"
                height={48}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
              />
              {OVERVIEW_CHART_SERIES.map(({ key, name, color }) => (
                <Bar key={key} dataKey={key} name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  )
}

