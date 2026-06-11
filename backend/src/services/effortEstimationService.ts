import { Types } from 'mongoose';
import { ProjectCellModel } from '../models/ProjectCell';
import { normalizeCellType } from './projectTypeChecklistService';

export type CellComplexity = 'Simple' | 'Medium' | 'Hard' | 'Critical';
export type EstimateConfidence = 'High' | 'Low';

/** One working day in hours. */
export const DEFAULT_BASE_HOURS = 8;

export const CELL_COMPLEXITY_OPTIONS: CellComplexity[] = ['Simple', 'Medium', 'Hard', 'Critical'];

export const COMPLEXITY_FACTOR: Record<CellComplexity, number> = {
  Simple: 1,
  Medium: 2,
  Hard: 3,
  Critical: 4,
};

export function normalizeComplexity(value: unknown): CellComplexity {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'simple' || raw === 'low') return 'Simple';
  if (raw === 'hard' || raw === 'high') return 'Hard';
  if (raw === 'critical') return 'Critical';
  return 'Medium';
}

export function complexityMatchValues(complexity: unknown): string[] {
  const normalized = normalizeComplexity(complexity);
  if (normalized === 'Simple') return ['Simple', 'Low'];
  if (normalized === 'Hard') return ['Hard', 'High'];
  if (normalized === 'Critical') return ['Critical'];
  return ['Medium'];
}

export function getComplexityFactor(complexity: unknown): number {
  return COMPLEXITY_FACTOR[normalizeComplexity(complexity)];
}

export function calculateEstimatedHours(baseHours: number, complexity: unknown): number {
  const base = Math.max(0, Number(baseHours) || 0);
  return roundHours(base * getComplexityFactor(complexity));
}

export function deriveBaseHours(
  estimatedEffort: number,
  complexity: unknown,
  storedBaseHours?: number | null,
): number {
  if (storedBaseHours != null && storedBaseHours > 0) return storedBaseHours;
  const estimated = Math.max(0, Number(estimatedEffort) || 0);
  const factor = getComplexityFactor(complexity);
  if (estimated <= 0 || factor <= 0) return DEFAULT_BASE_HOURS;
  return roundHours(estimated / factor);
}

export function resolveBaseHoursInput(
  baseHours: unknown,
  estimatedEffort: unknown,
  complexity: unknown,
): number {
  if (baseHours != null && baseHours !== '') {
    const parsed = Number(baseHours);
    if (!Number.isNaN(parsed)) return Math.max(0, parsed);
  }
  const estimated = Math.max(0, Number(estimatedEffort) || 0);
  if (estimated > 0) return deriveBaseHours(estimated, complexity);
  return DEFAULT_BASE_HOURS;
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

export type EffortPredictionInput = {
  cellType: string;
  technologyNode: string;
  complexity: CellComplexity;
  baseHours: number;
  excludeCellId?: string;
};

export type EffortPrediction = {
  baseHours: number;
  complexityFactor: number;
  estimatedHours: number;
  smartEstimate: number;
  avgVariance: number;
  similarBlockCount: number;
  confidence: EstimateConfidence;
};

export async function predictEffort(input: EffortPredictionInput): Promise<EffortPrediction> {
  const cellType = normalizeCellType(input.cellType);
  const technologyNode = String(input.technologyNode || '').trim();
  const complexity = normalizeComplexity(input.complexity);
  const baseHours = resolveBaseHoursInput(input.baseHours, undefined, complexity);
  const complexityFactor = getComplexityFactor(complexity);
  const estimatedHours = calculateEstimatedHours(baseHours, complexity);

  const query: Record<string, unknown> = {
    status: 'completed',
    cellType,
    technologyNode,
    complexity: { $in: complexityMatchValues(complexity) },
    estimatedEffort: { $gt: 0 },
    actualEffort: { $gt: 0 },
  };

  if (input.excludeCellId) {
    query._id = { $ne: new Types.ObjectId(input.excludeCellId) };
  }

  const similar = await ProjectCellModel.find(query).select('estimatedEffort actualEffort').lean();

  if (similar.length === 0) {
    return {
      baseHours,
      complexityFactor,
      estimatedHours,
      smartEstimate: estimatedHours,
      avgVariance: 1,
      similarBlockCount: 0,
      confidence: 'Low',
    };
  }

  const ratios = similar.map((cell) => Number(cell.actualEffort) / Number(cell.estimatedEffort));
  const avgVariance = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
  const smartEstimate = roundHours(estimatedHours * avgVariance);

  return {
    baseHours,
    complexityFactor,
    estimatedHours,
    smartEstimate,
    avgVariance: roundHours(avgVariance),
    similarBlockCount: similar.length,
    confidence: similar.length >= 3 ? 'High' : 'Low',
  };
}
