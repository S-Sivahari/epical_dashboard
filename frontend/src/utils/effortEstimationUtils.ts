export type CellComplexity = 'Low' | 'Medium' | 'High'
export type EstimateConfidence = 'High' | 'Low'

export const COMPLEXITY_FACTOR: Record<CellComplexity, number> = {
  Low: 1,
  Medium: 2,
  High: 3.5,
}

export const COMPLEXITY_LABEL: Record<CellComplexity, string> = {
  Low: 'SIMPLE',
  Medium: 'MEDIUM',
  High: 'HIGH',
}

export function normalizeComplexity(value: unknown): CellComplexity {
  return value === 'Low' || value === 'High' ? value : 'Medium'
}

export function getComplexityFactor(complexity: unknown): number {
  return COMPLEXITY_FACTOR[normalizeComplexity(complexity)]
}

export function roundHours(value: number): number {
  return Math.round(value * 100) / 100
}

export function calculateEstimatedHours(baseHours: number, complexity: unknown): number {
  const base = Math.max(0, Number(baseHours) || 0)
  return roundHours(base * getComplexityFactor(complexity))
}

export function deriveBaseHours(
  estimatedEffort: number,
  complexity: unknown,
  storedBaseHours?: number | null,
): number {
  if (storedBaseHours != null && storedBaseHours > 0) return storedBaseHours
  const estimated = Math.max(0, Number(estimatedEffort) || 0)
  const factor = getComplexityFactor(complexity)
  if (estimated <= 0 || factor <= 0) return 0
  return roundHours(estimated / factor)
}

export function formatComplexityFactor(complexity: unknown): string {
  const factor = getComplexityFactor(complexity)
  return factor % 1 === 0 ? `x${factor}` : `x${factor}`
}

export type EffortPrediction = {
  baseHours: number
  complexityFactor: number
  estimatedHours: number
  smartEstimate: number
  avgVariance: number
  similarBlockCount: number
  confidence: EstimateConfidence
}

export function buildEffortPredictionInsight(
  cell: {
    status?: string
    actualEffort?: number
    estimatedEffort?: number
    smartEstimate?: number
    estimateConfidence?: EstimateConfidence
    similarBlockCount?: number
  },
  actual: number,
  estimated: number,
  smartEstimate: number,
): string {
  const confidence = cell.estimateConfidence || 'Low'
  const similarCount = cell.similarBlockCount

  if (cell.status === 'completed' && actual === 0) {
    return 'Completed — log actual hours to improve future estimates.'
  }

  if (actual > 0 && estimated > 0) {
    const delta = actual - estimated
    if (delta > 0) return `Running ${roundHours(delta)}h over estimate.`
    if (delta < 0) return `Running ${roundHours(Math.abs(delta))}h under estimate.`
    return 'On track with the estimate.'
  }

  if (similarCount != null && similarCount > 0) {
    const variancePct = estimated > 0 ? Math.round(((smartEstimate - estimated) / estimated) * 100) : 0
    const varianceLabel = variancePct === 0 ? 'matches' : variancePct > 0 ? `${variancePct}% above` : `${Math.abs(variancePct)}% below`
    return `${confidence} confidence — ${similarCount} similar block${similarCount === 1 ? '' : 's'}; smart est. ${varianceLabel} base.`
  }

  return 'No similar historical data yet.'
}

export function buildLocalEffortPrediction(
  baseHours: number,
  complexity: unknown,
  completedCells: Array<{
    cellType?: string
    technologyNode?: string
    complexity?: string
    estimatedEffort?: number
    actualEffort?: number
    status?: string
  }> = [],
  match: { cellType?: string; technologyNode?: string; complexity?: unknown } = {},
): EffortPrediction {
  const normalizedComplexity = normalizeComplexity(complexity)
  const complexityFactor = getComplexityFactor(normalizedComplexity)
  const estimatedHours = calculateEstimatedHours(baseHours, normalizedComplexity)

  const similar = completedCells.filter((cell) => {
    if (cell.status !== 'completed') return false
    if ((cell.cellType || 'block') !== (match.cellType || 'block')) return false
    if ((cell.technologyNode || '').trim() !== (match.technologyNode || '').trim()) return false
    if (normalizeComplexity(cell.complexity) !== normalizedComplexity) return false
    const estimated = Number(cell.estimatedEffort) || 0
    const actual = Number(cell.actualEffort) || 0
    return estimated > 0 && actual > 0
  })

  if (similar.length === 0) {
    return {
      baseHours,
      complexityFactor,
      estimatedHours,
      smartEstimate: estimatedHours,
      avgVariance: 1,
      similarBlockCount: 0,
      confidence: 'Low',
    }
  }

  const ratios = similar.map((cell) => Number(cell.actualEffort) / Number(cell.estimatedEffort))
  const avgVariance = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length

  return {
    baseHours,
    complexityFactor,
    estimatedHours,
    smartEstimate: roundHours(estimatedHours * avgVariance),
    avgVariance: roundHours(avgVariance),
    similarBlockCount: similar.length,
    confidence: similar.length >= 3 ? 'High' : 'Low',
  }
}
