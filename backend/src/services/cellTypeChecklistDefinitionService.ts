import { Types } from 'mongoose';
import { ChecklistModel } from '../models/Checklist';
import { CellTypeChecklistDefinitionModel } from '../models/CellTypeChecklistDefinition';
import { ProjectCellModel, CELL_TYPES } from '../models/ProjectCell';
import {
  normalizeChecklistCellType,
  syncCellTypeChecklistForCell,
  type CellTypeKey,
} from './cellTypeChecklistService';

export interface CellTypeChecklistDefinitionDto {
  cellType: CellTypeKey;
  checklistName: string;
  description: string;
  items: { id: string; itemName: string; order: number }[];
  importedFromExcel: boolean;
  lastImportedAt?: Date;
  lastImportedBy?: string;
}

function toDto(doc: {
  cellType: CellTypeKey;
  checklistName: string;
  description: string;
  items: { _id: Types.ObjectId; itemName: string; order: number }[];
  importedFromExcel?: boolean;
  lastImportedAt?: Date;
  lastImportedBy?: string;
}): CellTypeChecklistDefinitionDto {
  return {
    cellType: doc.cellType,
    checklistName: doc.checklistName,
    description: doc.description || '',
    items: (doc.items ?? []).map((item) => ({
      id: item._id.toString(),
      itemName: item.itemName,
      order: item.order ?? 0,
    })),
    importedFromExcel: Boolean(doc.importedFromExcel),
    lastImportedAt: doc.lastImportedAt,
    lastImportedBy: doc.lastImportedBy,
  };
}

export async function getCellTypeChecklistDefinition(
  cellType: string,
): Promise<CellTypeChecklistDefinitionDto | null> {
  const normalized = normalizeChecklistCellType(cellType);
  const doc = await CellTypeChecklistDefinitionModel.findOne({ cellType: normalized }).lean();
  return doc ? toDto(doc as Parameters<typeof toDto>[0]) : null;
}

export async function listCellTypeChecklistDefinitions(): Promise<CellTypeChecklistDefinitionDto[]> {
  const docs = await CellTypeChecklistDefinitionModel.find().sort({ cellType: 1 }).lean();
  return docs.map((doc) => toDto(doc as Parameters<typeof toDto>[0]));
}

async function syncDefinitionToChecklistModel(
  cellType: CellTypeKey,
  payload: {
    checklistName: string;
    description: string;
    items: { itemName: string; order: number }[];
  },
  actor?: string,
  importedFromExcel = false,
): Promise<Types.ObjectId> {
  const itemDocs = payload.items.map((item, idx) => ({
    _id: new Types.ObjectId(),
    itemName: item.itemName,
    order: idx,
  }));

  await CellTypeChecklistDefinitionModel.findOneAndUpdate(
    { cellType },
    {
      cellType,
      checklistName: payload.checklistName,
      description: payload.description,
      items: itemDocs,
      importedFromExcel,
      lastImportedAt: importedFromExcel ? new Date() : undefined,
      lastImportedBy: importedFromExcel ? actor : undefined,
    },
    { upsert: true, new: true },
  );

  let checklist = await ChecklistModel.findOne({ cellType });
  if (checklist) {
    checklist.name = payload.checklistName;
    checklist.description = payload.description;
    checklist.items = itemDocs;
    await checklist.save();
    return checklist._id;
  }

  checklist = await ChecklistModel.create({
    name: payload.checklistName,
    description: payload.description,
    cellType,
    items: itemDocs,
    createdBy: actor || 'System',
  });
  return checklist._id;
}

export async function upsertCellTypeChecklistFromExcel(
  cellType: CellTypeKey,
  payload: {
    checklistName: string;
    description: string;
    items: { itemName: string; order: number }[];
  },
  actor?: string,
): Promise<void> {
  if (!payload.items.length) {
    throw new Error(`At least one item is required for ${cellType} checklist`);
  }

  payload.items.sort((a, b) => a.order - b.order);
  await syncDefinitionToChecklistModel(cellType, payload, actor, true);
  await resyncAllCellsForCellType(cellType);
}

export async function resyncAllCellsForCellType(cellType: CellTypeKey): Promise<number> {
  const cells = await ProjectCellModel.find({ cellType });
  for (const cell of cells) {
    await syncCellTypeChecklistForCell(cell.projectId, cell._id);
  }
  return cells.length;
}

export async function ensureCellTypeDefinitionsFromSeeds(
  seeds: Record<
    CellTypeKey,
    { name: string; description: string; items: string[] }
  >,
): Promise<{ created: number }> {
  let created = 0;

  for (const cellType of CELL_TYPES) {
    const existing = await CellTypeChecklistDefinitionModel.findOne({ cellType });
    if (existing) continue;

    const seed = seeds[cellType];
    await syncDefinitionToChecklistModel(
      cellType,
      {
        checklistName: seed.name,
        description: seed.description,
        items: seed.items.map((itemName, order) => ({ itemName, order: order + 1 })),
      },
      'System',
      false,
    );
    created += 1;
  }

  return { created };
}
