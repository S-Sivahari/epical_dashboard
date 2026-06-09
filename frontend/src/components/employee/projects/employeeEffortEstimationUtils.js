import { getViewProgressStatus } from '@/utils/cellWorkflowUi'

const COMPLEXITY_FACTOR = {
  Low: 1,
  Medium: 1.25,
  High: 1.5,
}

const COMPLEXITY_LABEL = {
  Low: 'SIMPLE',
  Medium: 'MEDIUM',
  High: 'HIGH',
}

export function formatHours(value) {
  const hours = Number(value) || 0
  return `${hours}h`
}

export function formatVariance(value) {
  if (value === 0) return '—'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value}h`
}

function complexityMeta(complexity) {
  const key = complexity && COMPLEXITY_FACTOR[complexity] ? complexity : 'Medium'
  return {
    label: COMPLEXITY_LABEL[key] || 'MEDIUM',
    tone: key === 'Low' ? 'simple' : key === 'High' ? 'high' : 'medium',
    factor: COMPLEXITY_FACTOR[key] || 1,
  }
}

function predictionInsight(cell, actual, estimated) {
  const status = getViewProgressStatus(cell, 'layout')
  if (status === 'completed' && actual === 0) {
    return 'Completed — log actual hours to improve future estimates.'
  }
  if (actual > 0 && estimated > 0) {
    const delta = actual - estimated
    if (delta > 0) return `Running ${delta}h over estimate.`
    if (delta < 0) return `Running ${Math.abs(delta)}h under estimate.`
    return 'On track with the estimate.'
  }
  return 'No similar historical data yet.'
}

export function buildEffortEstimationRows(cells = []) {
  return cells.map((cell) => {
    const { label, tone, factor } = complexityMeta(cell.complexity)
    const estimated = Number(cell.estimatedEffort) || 0
    const base = factor > 0 ? Math.round(estimated / factor) : estimated
    const smartEst = estimated
    const actual = 0
    const variance = actual - estimated

    return {
      id: cell.id,
      name: cell.name,
      complexityLabel: label,
      complexityTone: tone,
      base,
      factorLabel: `x${factor}`,
      estimated,
      smartEst,
      actual,
      variance,
      varianceTone: variance < 0 ? 'under' : variance > 0 ? 'over' : 'neutral',
      isComplete: getViewProgressStatus(cell, 'layout') === 'completed',
      insight: predictionInsight(cell, actual, estimated),
    }
  })
}

export function buildEffortEstimationSummary(cells = []) {
  const rows = buildEffortEstimationRows(cells)
  const totalEstimated = rows.reduce((sum, row) => sum + row.estimated, 0)
  const totalActual = rows.reduce((sum, row) => sum + row.actual, 0)
  const variance = totalActual - totalEstimated
  const completed = rows.filter((row) => row.isComplete).length
  const total = rows.length
  const percentComplete = total ? Math.round((completed / total) * 100) : 0

  return {
    totalEstimated,
    totalActual,
    variance,
    varianceTone: variance < 0 ? 'under' : variance > 0 ? 'over' : 'neutral',
    percentComplete,
    completed,
    total,
  }
}
