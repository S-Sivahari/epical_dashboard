import { Types } from 'mongoose';
import { ChecklistModel } from '../models/Checklist';
import { CellChecklistMappingModel } from '../models/Checklist';
import { ProjectCellModel, CELL_TYPES } from '../models/ProjectCell';

export type CellTypeKey = (typeof CELL_TYPES)[number];

const CELL_TYPE_CHECKLIST_SEEDS: Record<
  CellTypeKey,
  { name: string; description: string; items: string[] }
> = {
  block: {
    name: 'BLOCK Cell Verification',
    description: 'Standard verification checklist for BLOCK layout cells',
    items: [
      'Floor plan completeness review',
      'Power strap verification',
      'Well and tie-off check',
      'DRC zero violations',
      'Antenna cell review',
    ],
  },
  IOP: {
    name: 'IO Cell Verification',
    description: 'Standard verification checklist for IO pad ring cells',
    items: [
      'Pad ring alignment check',
      'ESD clamp placement review',
      'Bond pad pitch verification',
      'IO timing constraint review',
      'Peripheral power domain check',
    ],
  },
  ESD: {
    name: 'ESD Cell Verification',
    description: 'Standard verification checklist for ESD protection cells',
    items: [
      'ESD device sizing review',
      'Trigger circuit verification',
      'Clamp leakage measurement',
      'Human body model simulation',
      'CDM robustness review',
    ],
  },
  TOP: {
    name: 'TOP Cell Verification',
    description: 'Standard verification checklist for top-level integration cells',
    items: [
      'Top-level integration review',
      'Clock tree distribution check',
      'Power mesh continuity',
      'Chip-level LVS sign-off',
      'Seal ring verification',
    ],
  },
};

export function normalizeChecklistCellType(value?: string | null): CellTypeKey {
  const raw = String(value ?? '').trim();
  if (raw.toLowerCase() === 'io') return 'IOP';
  if ((CELL_TYPES as readonly string[]).includes(raw)) return raw as CellTypeKey;
  return 'block';
}

export async function ensureCellTypeChecklists(): Promise<{ created: number }> {
  const { ensureCellTypeDefinitionsFromSeeds } = await import('./cellTypeChecklistDefinitionService');
  return ensureCellTypeDefinitionsFromSeeds(CELL_TYPE_CHECKLIST_SEEDS);
}

export async function findChecklistForCellType(cellType: string) {
  const normalized = normalizeChecklistCellType(cellType);
  const { CellTypeChecklistDefinitionModel } = await import('../models/CellTypeChecklistDefinition');

  let definition = await CellTypeChecklistDefinitionModel.findOne({ cellType: normalized });
  if (!definition) {
    await ensureCellTypeChecklists();
    definition = await CellTypeChecklistDefinitionModel.findOne({ cellType: normalized });
  }

  return ChecklistModel.findOne({ cellType: normalized });
}

export async function syncCellTypeChecklistForCell(
  projectId: Types.ObjectId,
  cellId: Types.ObjectId,
): Promise<void> {
  const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
  if (!cell) return;

  await ensureCellTypeChecklists();

  const checklist = await findChecklistForCellType(cell.cellType);
  if (!checklist) return;

  const existing = await CellChecklistMappingModel.find({ projectId, cellId }).lean();
  const sameChecklist =
    existing.length > 0 && existing.every((entry) => entry.checklistId.equals(checklist._id));

  if (sameChecklist && existing.length === checklist.items.length) {
    const itemIds = new Set(checklist.items.map((item) => item._id.toString()));
    if (existing.every((entry) => itemIds.has(entry.checklistItemId.toString()))) {
      return;
    }
  }

  const preserved = new Map<
    string,
    {
      response?: string | null;
      comment?: string;
      status?: string;
      appliedBy?: string;
      appliedByName?: string;
      appliedDate?: Date;
    }
  >();

  for (const entry of existing) {
    preserved.set(entry.itemName.toLowerCase(), {
      response: entry.response ?? null,
      comment: entry.comment ?? '',
      status: entry.status,
      appliedBy: entry.appliedBy,
      appliedByName: entry.appliedByName,
      appliedDate: entry.appliedDate,
    });
  }

  await CellChecklistMappingModel.deleteMany({ projectId, cellId });

  const bulk = checklist.items.map((item) => {
    const prev = preserved.get(item.itemName.toLowerCase());
    return {
      projectId,
      cellId,
      checklistId: checklist._id,
      checklistItemId: item._id,
      itemName: item.itemName,
      status: prev?.status ?? 'Pending',
      response: prev?.response ?? null,
      comment: prev?.comment ?? '',
      appliedBy: prev?.appliedBy,
      appliedByName: prev?.appliedByName,
      appliedDate: prev?.appliedDate,
    };
  });

  if (bulk.length) {
    await CellChecklistMappingModel.insertMany(bulk, { ordered: false });
  }
}

export function checklistEntriesFilled(
  entries: Array<{ response?: string | null; comment?: string }>,
): boolean {
  if (entries.length === 0) return true;
  return entries.every((entry) => {
    if (!entry.response) return false;
    if (entry.response === 'no' || entry.response === 'not_applicable') {
      return Boolean(entry.comment?.trim());
    }
    return true;
  });
}

export async function isCellChecklistFilled(projectId: string, cellId: string): Promise<boolean> {
  const projectOid = new Types.ObjectId(projectId);
  const cellOid = new Types.ObjectId(cellId);
  await syncCellTypeChecklistForCell(projectOid, cellOid);
  const entries = await CellChecklistMappingModel.find({ projectId: projectOid, cellId: cellOid }).lean();
  return checklistEntriesFilled(entries);
}

export async function assertCellChecklistFilled(projectId: string, cellId: string): Promise<void> {
  const filled = await isCellChecklistFilled(projectId, cellId);
  if (!filled) {
    throw new Error('Complete the checklist before marking this stage as completed');
  }
}

export async function buildCellChecklistDetail(projectId: string, cellId: string) {
  const projectOid = new Types.ObjectId(projectId);
  const cellOid = new Types.ObjectId(cellId);

  await syncCellTypeChecklistForCell(projectOid, cellOid);

  const cell = await ProjectCellModel.findOne({ _id: cellOid, projectId: projectOid }).lean();
  const entries = await CellChecklistMappingModel.find({ projectId: projectOid, cellId: cellOid }).sort({
    itemName: 1,
  });

  const checklistId = entries[0]?.checklistId ?? null;
  const checklist = checklistId ? await ChecklistModel.findById(checklistId).lean() : null;

  const allApplied = entries.length > 0 && entries.every((entry) => entry.response === 'yes');
  const isFilled = checklistEntriesFilled(entries);
  let cellStatus: 'Applied' | 'Pending' | 'Not Assigned' = 'Not Assigned';
  if (!checklist) cellStatus = 'Not Assigned';
  else if (allApplied) cellStatus = 'Applied';
  else if (entries.some((entry) => entry.response)) cellStatus = 'Pending';
  else if (entries.length > 0) cellStatus = 'Pending';

  return {
    checklistId: checklist ? String(checklist._id) : null,
    checklistName: checklist?.name ?? '',
    cellType: cell?.cellType ?? '',
    cellStatus,
    isFilled,
    items: entries.map((entry) => ({
      id: entry._id.toString(),
      checklistItemId: entry.checklistItemId.toString(),
      itemName: entry.itemName,
      status: entry.status,
      response: entry.response ?? null,
      comment: entry.comment ?? '',
      appliedBy: entry.appliedByName || entry.appliedBy || '',
      appliedDate: entry.appliedDate,
    })),
  };
}
