import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type {
  ImpedanceAverageStatus,
  ImpedanceEngineeringStats,
  ImpedanceInsightItem,
  ImpedanceInsightSummary,
  ImpedanceRoutePoint,
  ImpedanceRouteTableRow,
  ImpedanceRunRange,
  ImpedanceTrendIntel,
} from '@/types/pdkMetalRouting'

const MAX_CHART_POINTS = 120

export const IMPEDANCE_RANGE_OPTIONS: { key: ImpedanceRunRange; label: string }[] = [
  { key: '1', label: 'Last Run' },
  { key: '7', label: 'Last 7 Runs' },
  { key: '30', label: 'Last 30 Runs' },
  { key: 'all', label: 'All Runs' },
]

function roundOhm(value: number): number {
  return Math.round(value * 10000) / 10000
}

export function sliceImpedanceRange(
  points: ImpedanceRoutePoint[],
  range: ImpedanceRunRange,
): ImpedanceRoutePoint[] {
  if (range === 'all') return points
  const count = range === '1' ? 1 : range === '7' ? 7 : 30
  return points.slice(-count).map((point, index) => ({
    ...point,
    routeLabel: `R${index + 1}`,
  }))
}

export function downsampleChartPoints(points: ImpedanceRoutePoint[]): ImpedanceRoutePoint[] {
  if (points.length <= MAX_CHART_POINTS) return points
  const step = points.length / MAX_CHART_POINTS
  return Array.from({ length: MAX_CHART_POINTS }, (_, index) => {
    const source = points[Math.min(points.length - 1, Math.floor(index * step))]
    return { ...source, routeLabel: `R${index + 1}` }
  })
}

export function computeImpedanceStats(points: ImpedanceRoutePoint[]): ImpedanceEngineeringStats {
  if (points.length === 0) {
    return {
      average: 0,
      min: 0,
      minRouteLabel: '—',
      max: 0,
      maxRouteLabel: '—',
      total: 0,
      measuredRouteCount: 0,
    }
  }

  let min = points[0].impedance
  let max = points[0].impedance
  let minRouteLabel = points[0].routeLabel
  let maxRouteLabel = points[0].routeLabel
  let total = 0

  for (const point of points) {
    total += point.impedance
    if (point.impedance < min) {
      min = point.impedance
      minRouteLabel = point.routeLabel
    }
    if (point.impedance > max) {
      max = point.impedance
      maxRouteLabel = point.routeLabel
    }
  }

  return {
    average: roundOhm(total / points.length),
    min: roundOhm(min),
    minRouteLabel,
    max: roundOhm(max),
    maxRouteLabel,
    total: roundOhm(total),
    measuredRouteCount: points.length,
  }
}

export function computeImpedanceTrend(points: ImpedanceRoutePoint[]): ImpedanceTrendIntel {
  if (points.length === 0) {
    return {
      direction: 'stable',
      previousImpedance: 0,
      currentImpedance: 0,
      changeOhm: 0,
      changePercent: 0,
    }
  }

  if (points.length === 1) {
    return {
      direction: 'stable',
      previousImpedance: points[0].impedance,
      currentImpedance: points[0].impedance,
      changeOhm: 0,
      changePercent: 0,
    }
  }

  const previousImpedance = points[points.length - 2].impedance
  const currentImpedance = points[points.length - 1].impedance
  const changeOhm = roundOhm(currentImpedance - previousImpedance)
  const changePercent =
    previousImpedance > 0 ? Math.round((changeOhm / previousImpedance) * 1000) / 10 : 0
  const direction =
    Math.abs(changeOhm) < 0.0005 ? 'stable' : changeOhm > 0 ? 'increasing' : 'decreasing'

  return {
    direction,
    previousImpedance: roundOhm(previousImpedance),
    currentImpedance: roundOhm(currentImpedance),
    changeOhm,
    changePercent,
  }
}

export function generateImpedanceInsights(
  points: ImpedanceRoutePoint[],
  stats: ImpedanceEngineeringStats,
): ImpedanceInsightSummary {
  if (points.length === 0) {
    return {
      headline: 'Impedance Analysis',
      details: ['No impedance analysis available. Complete metal calculations on routes to begin.'],
    }
  }

  const details: string[] = []
  const spikeThreshold = stats.average * 2
  const hasSpike = points.some((point) => point.impedance > spikeThreshold)
  const withinRange = stats.max <= stats.average * 1.35

  if (withinRange && !hasSpike) {
    details.push('Average impedance remains within acceptable range.')
  }
  details.push(`Highest impedance observed on Route ${stats.maxRouteLabel}.`)
  if (stats.minRouteLabel !== stats.maxRouteLabel) {
    details.push(`Lowest impedance recorded on Route ${stats.minRouteLabel}.`)
  }
  if (hasSpike) {
    details.push('Abnormal impedance spikes detected in the selected window.')
  } else {
    details.push('No abnormal spikes detected.')
  }

  return {
    headline: 'Impedance Analysis',
    details,
  }
}

export function getImpedanceYDomain(points: ImpedanceRoutePoint[]): [number, number] {
  if (points.length === 0) return [0, 1]
  const max = Math.max(...points.map((point) => point.impedance), 0.01)
  const padding = max * 0.18
  const ceiling = Math.ceil((max + padding) * 10) / 10
  return [0, Math.max(ceiling, 0.5)]
}

export function enrichChartPoints(
  points: ImpedanceRoutePoint[],
  stats: ImpedanceEngineeringStats,
): Array<
  ImpedanceRoutePoint & {
    deltaFromAverage: number
    percentFromAverage: number
  }
> {
  return points.map((point) => ({
    ...point,
    deltaFromAverage: roundOhm(point.impedance - stats.average),
    percentFromAverage:
      stats.average > 0
        ? Math.round(((point.impedance - stats.average) / stats.average) * 1000) / 10
        : 0,
  }))
}

export function getAverageImpedanceStatus(stats: ImpedanceEngineeringStats): ImpedanceAverageStatus {
  if (stats.measuredRouteCount === 0) {
    return { label: 'No Data', tone: 'warning' }
  }
  const spreadRatio = stats.average > 0 ? stats.max / stats.average : 1
  if (spreadRatio > 2) return { label: 'Elevated Spread', tone: 'danger' }
  if (spreadRatio > 1.35) return { label: 'Monitor', tone: 'warning' }
  return { label: 'Within Range', tone: 'success' }
}

export function buildRouteAnalysisRows(
  points: ImpedanceRoutePoint[],
  stats: ImpedanceEngineeringStats,
): ImpedanceRouteTableRow[] {
  const ranked = [...points]
    .sort((a, b) => b.impedance - a.impedance)
    .map((point, index) => ({ routeId: point.routeId, rank: index + 1 }))

  const rankById = new Map(ranked.map((entry) => [entry.routeId, entry.rank]))

  return points.map((point, index) => {
    const prev = index > 0 ? points[index - 1].impedance : point.impedance
    const delta = roundOhm(point.impedance - prev)
    const trendDirection =
      Math.abs(delta) < 0.0005 ? 'stable' : delta > 0 ? 'up' : 'down'

    return {
      ...point,
      vsAverage: roundOhm(point.impedance - stats.average),
      changePercent:
        stats.average > 0
          ? Math.round(((point.impedance - stats.average) / stats.average) * 1000) / 10
          : 0,
      rank: rankById.get(point.routeId) ?? points.length,
      trendDirection,
    }
  })
}

export function buildStructuredInsights(
  points: ImpedanceRoutePoint[],
  stats: ImpedanceEngineeringStats,
): ImpedanceInsightItem[] {
  if (points.length === 0) {
    return [{ tone: 'info', message: 'No impedance analysis available for this project.' }]
  }

  const items: ImpedanceInsightItem[] = []
  const spikeThreshold = stats.average * 2
  const hasSpike = points.some((point) => point.impedance > spikeThreshold)
  const withinRange = stats.max <= stats.average * 1.35
  const values = points.map((p) => p.impedance)
  const spread = Math.max(...values) - Math.min(...values)
  const variationStable = stats.average > 0 ? spread / stats.average <= 0.5 : true

  items.push({
    tone: withinRange && !hasSpike ? 'success' : 'warning',
    message: withinRange && !hasSpike
      ? 'Average impedance within acceptable range'
      : 'Average impedance outside preferred operating range',
  })
  items.push({
    tone: 'warning',
    message: `Highest impedance observed on Route ${stats.maxRouteLabel}`,
  })
  if (stats.minRouteLabel !== stats.maxRouteLabel) {
    items.push({
      tone: 'success',
      message: `Lowest impedance recorded on Route ${stats.minRouteLabel}`,
    })
  }
  items.push({
    tone: hasSpike ? 'warning' : 'success',
    message: hasSpike ? 'Abnormal impedance spikes detected' : 'No abnormal spikes detected',
  })
  items.push({
    tone: variationStable ? 'success' : 'info',
    message: variationStable
      ? 'Impedance variation remains stable'
      : 'Impedance variation shows moderate spread across routes',
  })

  return items
}

export function generateExecutiveSummary(
  points: ImpedanceRoutePoint[],
  stats: ImpedanceEngineeringStats,
): string[] {
  if (points.length === 0) {
    return ['No analyzed routes are available for executive summary generation.']
  }

  const hasSpike = points.some((point) => point.impedance > stats.average * 2)
  const withinLimits = stats.max <= stats.average * 1.35 && !hasSpike

  return [
    `The project contains ${stats.measuredRouteCount} analyzed route${stats.measuredRouteCount === 1 ? '' : 's'} with an average impedance of ${stats.average.toFixed(2)} Ω.`,
    `Route ${stats.maxRouteLabel} recorded the highest impedance value of ${stats.max.toFixed(2)} Ω.`,
    hasSpike
      ? 'Severe impedance anomalies were detected and should be reviewed before sign-off.'
      : 'No severe impedance anomalies or instability patterns were detected.',
    withinLimits
      ? 'Overall routing quality remains within expected operating limits.'
      : 'Overall routing quality shows elevated impedance spread; targeted route review is recommended.',
  ]
}

export function enrichReportChartPoints(
  points: ImpedanceRoutePoint[],
  stats: ImpedanceEngineeringStats,
  tableRows: ImpedanceRouteTableRow[],
): Array<
  ImpedanceRoutePoint & {
    deltaFromAverage: number
    percentFromAverage: number
    rank: number
  }
> {
  const rowById = new Map(tableRows.map((row) => [row.routeId, row]))
  return points.map((point) => {
    const row = rowById.get(point.routeId)
    return {
      ...point,
      deltaFromAverage: row?.vsAverage ?? roundOhm(point.impedance - stats.average),
      percentFromAverage: row?.changePercent ?? 0,
      rank: row?.rank ?? 0,
    }
  })
}

export async function exportImpedanceExcel(
  rows: ImpedanceRouteTableRow[],
  stats: ImpedanceEngineeringStats,
  projectName: string | null,
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Impedance Analysis')
  sheet.addRow(['Impedance Analysis Report'])
  sheet.addRow(['Project', projectName ?? ''])
  sheet.addRow(['Average (Ω)', stats.average])
  sheet.addRow(['Total (Ω)', stats.total])
  sheet.addRow([])
  sheet.addRow(['Route', 'Path', 'Impedance (Ω)', 'Vs Average', 'Change %', 'Rank', 'Trend'])
  rows.forEach((row) => {
    sheet.addRow([
      row.routeLabel,
      row.routeName,
      row.impedance,
      row.vsAverage,
      row.changePercent,
      row.rank,
      row.trendDirection,
    ])
  })
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `impedance-report-${projectName ?? 'project'}.xlsx`
  link.click()
  URL.revokeObjectURL(url)
}

export function exportImpedancePdf(
  rows: ImpedanceRouteTableRow[],
  stats: ImpedanceEngineeringStats,
  projectName: string | null,
  summary: string[],
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setFontSize(16)
  doc.text('Impedance Analysis Report', 40, 40)
  doc.setFontSize(10)
  doc.text(`Project: ${projectName ?? '—'} · Routes: ${stats.measuredRouteCount}`, 40, 58)
  doc.text(`Average: ${stats.average.toFixed(2)} Ω · Total: ${stats.total.toFixed(2)} Ω`, 40, 72)

  autoTable(doc, {
    startY: 90,
    head: [['Route', 'Impedance', 'Vs Avg', 'Change %', 'Rank', 'Trend']],
    body: rows.map((row) => [
      row.routeLabel,
      `${row.impedance.toFixed(2)} Ω`,
      `${row.vsAverage >= 0 ? '+' : ''}${row.vsAverage.toFixed(2)} Ω`,
      `${row.changePercent}%`,
      `#${row.rank}`,
      row.trendDirection,
    ]),
  })

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120
  doc.text('Analysis Summary', 40, finalY + 24)
  summary.forEach((line, index) => {
    doc.text(line, 40, finalY + 40 + index * 14, { maxWidth: 760 })
  })

  doc.save(`impedance-report-${projectName ?? 'project'}.pdf`)
}

export function exportImpedanceCsv(
  points: ImpedanceRoutePoint[],
  stats: ImpedanceEngineeringStats,
  projectName: string | null,
): void {
  const rows = [
    ['Project', projectName ?? ''],
    ['Average Impedance (Ω)', stats.average],
    ['Min Impedance (Ω)', stats.min],
    ['Max Impedance (Ω)', stats.max],
    ['Total Impedance (Ω)', stats.total],
    [],
    ['Route', 'Path', 'Signal', 'Impedance (Ω)', 'Updated At'],
    ...points.map((point) => [
      point.routeLabel,
      point.routeName,
      point.signalPath,
      point.impedance,
      point.updatedAt,
    ]),
  ]

  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `impedance-analysis-${projectName ?? 'project'}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
