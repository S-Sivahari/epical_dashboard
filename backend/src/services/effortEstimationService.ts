import { Types } from 'mongoose';
import { ProjectCellModel } from '../models/ProjectCell';
import { normalizeCellType } from './projectTypeChecklistService';

export type CellComplexity = 'Low' | 'Medium' | 'High';
export type EstimateConfidence = 'High' | 'Low';

export const COMPLEXITY_FACTOR: Record<CellComplexity, number> = {
  Low: 1,
  Medium: 2,
  High: 3.5,
};

export function normalizeComplexity(value: unknown): CellComplexity {
  return value === 'Low' || value === 'High' ? value : 'Medium';
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
  if (estimated <= 0 || factor <= 0) return 0;
  return roundHours(estimated / factor);
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
  const baseHours = Math.max(0, Number(input.baseHours) || 0);
  const complexityFactor = getComplexityFactor(complexity);
  const estimatedHours = calculateEstimatedHours(baseHours, complexity);

  const query: Record<string, unknown> = {
    status: 'completed',
    cellType,
    technologyNode,
    complexity,
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
