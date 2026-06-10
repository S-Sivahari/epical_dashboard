import { Types } from 'mongoose';
import { ProjectCellModel, type CellChecklistExtension } from '../models/ProjectCell';
import {
  canCompleteCell,
  normalizeCellWorkflow,
  normalizeViewWorkflow,
} from '../utils/cellWorkflow';
import {
  buildCellChecklistItems,
  normalizeChecklistExtension,
  resolveCellContext,
} from './projectTypeChecklistService';

export type CellCompletionSectionKey =
  | 'layoutDetails'
  | 'checklist'
  | 'customizedFields'
  | 'finalCellDetails';

export type CellCompletionReadiness = {
  canComplete: boolean;
  sections: Record<CellCompletionSectionKey, boolean>;
  missing: string[];
};

const SECTION_LABELS: Record<CellCompletionSectionKey, string> = {
  layoutDetails: 'Layout details',
  checklist: 'Checklist questions',
  customizedFields: 'Symbol and schematic views',
  finalCellDetails: 'Final cell details',
};

export function isFinalCellDetailsComplete(
  extension?: Partial<CellChecklistExtension> | null,
): boolean {
  const ext = normalizeChecklistExtension(extension);
  return (
    ext.dimensionX != null &&
    ext.dimensionY != null &&
    ext.highestMetalUsed.trim() !== '' &&
    ext.virtualConnection != null &&
    ext.overallSubstrateContact != null &&
    ext.waivableDrcError != null
  );
}

export function isLayoutDetailsComplete(workflow: unknown): boolean {
  return canCompleteCell(normalizeCellWorkflow(workflow));
}

export function isCustomizedFieldsComplete(cell: {
  views?: { symbol?: string; schematic?: string };
  viewWorkflow?: unknown;
}): boolean {
  const views = normalizeViewWorkflow(cell.viewWorkflow);
  const symbolDone = views.symbol.status === 'completed' || cell.views?.symbol === 'completed';
  const schematicDone = cell.views?.schematic === 'completed';
  return symbolDone && schematicDone;
}

export function isChecklistQuestionsComplete(
  items: { response: string | null }[],
): boolean {
  if (items.length === 0) return true;
  return items.every((item) => Boolean(item.response));
}

export async function evaluateCellCompletionReadiness(
  projectId: string,
  cellId: string,
): Promise<CellCompletionReadiness | null> {
  const context = await resolveCellContext(projectId, cellId);
  if (!context) return null;

  const items = await buildCellChecklistItems(context);
  const sections: Record<CellCompletionSectionKey, boolean> = {
    layoutDetails: isLayoutDetailsComplete(context.cell.workflow),
    checklist: isChecklistQuestionsComplete(items),
    customizedFields: isCustomizedFieldsComplete(context.cell),
    finalCellDetails: isFinalCellDetailsComplete(context.cell.checklistExtension),
  };

  const missing = (Object.keys(sections) as CellCompletionSectionKey[])
    .filter((key) => !sections[key])
    .map((key) => SECTION_LABELS[key]);

  return {
    canComplete: missing.length === 0,
    sections,
    missing,
  };
}

/** Move cell from Not Started → In Progress, or Completed → In Progress when edited. */
export async function markCellTouched(projectId: string, cellId: string): Promise<void> {
  const cell = await ProjectCellModel.findOne({
    _id: new Types.ObjectId(cellId),
    projectId: new Types.ObjectId(projectId),
  });
  if (!cell) return;

  if (cell.status === 'completed' || cell.status === 'ready') {
    cell.status = 'in_progress';
    await cell.save();
  }
}
