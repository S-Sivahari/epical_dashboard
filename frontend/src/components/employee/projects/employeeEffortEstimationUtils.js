import { getViewProgressStatus } from '@/utils/cellWorkflowUi'
import {
  buildEffortPredictionInsight,
  calculateEstimatedHours,
  COMPLEXITY_LABEL,
  deriveBaseHours,
  formatComplexityFactor,
  getComplexityFactor,
  normalizeComplexity,
  roundHours,
} from '@/utils/effortEstimationUtils'

export function formatHours(value) {
  const hours = roundHours(Number(value) || 0)
  return `${hours}h`
}

export function formatVariance(value) {
  if (value === 0) return '—'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${roundHours(value)}h`
}

function complexityMeta(complexity) {
  const key = normalizeComplexity(complexity)
  return {
    label: COMPLEXITY_LABEL[key] || 'MEDIUM',
    tone: key === 'Low' ? 'simple' : key === 'High' ? 'high' : 'medium',
    factor: getComplexityFactor(key),
  }
}

export function buildEffortEstimationRows(cells = []) {
  return cells.map((cell) => {
    const { label, tone, factor } = complexityMeta(cell.complexity)
    const base = deriveBaseHours(cell.estimatedEffort, cell.complexity, cell.baseHours)
    const estimated = Number(cell.estimatedEffort) || calculateEstimatedHours(base, cell.complexity)
    const smartEst = Number(cell.smartEstimate) || estimated
    const actual = Number(cell.actualEffort) || 0
    const variance = actual - estimated

    return {
      id: cell.id,
      name: cell.name,
      complexityLabel: label,
      complexityTone: tone,
      base,
      factorLabel: formatComplexityFactor(cell.complexity),
      estimated,
      smartEst,
      actual,
      variance,
      varianceTone: variance < 0 ? 'under' : variance > 0 ? 'over' : 'neutral',
      confidence: cell.estimateConfidence || 'Low',
      isComplete: getViewProgressStatus(cell, 'layout') === 'completed',
      insight: buildEffortPredictionInsight(cell, actual, estimated, smartEst),
    }
  })
}

export function buildEffortEstimationSummary(cells = []) {
  const rows = buildEffortEstimationRows(cells)
  const totalEstimated = rows.reduce((sum, row) => sum + row.estimated, 0)
  const totalSmart = rows.reduce((sum, row) => sum + row.smartEst, 0)
  const totalActual = rows.reduce((sum, row) => sum + row.actual, 0)
  const variance = totalActual - totalEstimated
  const completed = rows.filter((row) => row.isComplete).length
  const total = rows.length
  const percentComplete = total ? Math.round((completed / total) * 100) : 0

  return {
    totalEstimated,
    totalSmart,
    totalActual,
    variance,
    varianceTone: variance < 0 ? 'under' : variance > 0 ? 'over' : 'neutral',
    percentComplete,
    completed,
    total,
  }
}

export {
  buildLocalEffortPrediction,
  calculateEstimatedHours,
  formatComplexityFactor,
} from '@/utils/effortEstimationUtils'
