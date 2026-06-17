import { Types } from 'mongoose';
import { ChecklistModel, ProjectChecklistModel, CellChecklistMappingModel } from '../models/Checklist';
import { CellTypeChecklistDefinitionModel } from '../models/CellTypeChecklistDefinition';
import { ProjectCellModel } from '../models/ProjectCell';
import { recalcProjectChecklistProgress } from './checklistService';
import { normalizeChecklistCellType } from './cellTypeChecklistService';
import { upsertCellTypeChecklistFromExcel } from './cellTypeChecklistDefinitionService';
import { CELL_TYPES } from '../models/ProjectCell';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatCellTypeLabel(cellType: string): string {
  const labels: Record<string, string> = {
    block: 'BLOCK',
    IO: 'IO',
    IOP: 'IO',
    ESD: 'ESD',
    TOP: 'TOP',
  };
  return labels[cellType] ?? cellType;
}

function rowCellType(row: Record<string, unknown>): string {
  return String(row.cellType ?? row['Cell Type'] ?? row['cell type'] ?? '').trim();
}

export interface ChecklistTemplateRow {
  checklistName: string;
  cellType: string;
  description: string;
  itemName: string;
  itemOrder: number;
}
export async function buildChecklistTemplateExportRows(): Promise<ChecklistTemplateRow[]> {
  const rows: ChecklistTemplateRow[] = [];

  const definitions = await CellTypeChecklistDefinitionModel.find().sort({ cellType: 1 }).lean();
  for (const def of definitions) {
    if (!def.items?.length) {
      rows.push({
        checklistName: def.checklistName,
        cellType: formatCellTypeLabel(def.cellType),
        description: def.description || '',
        itemName: '',
        itemOrder: 1,
      });
      continue;
    }
    for (const item of def.items) {
      rows.push({
        checklistName: def.checklistName,
        cellType: formatCellTypeLabel(def.cellType),
        description: def.description || '',
        itemName: item.itemName,
        itemOrder: (item.order ?? 0) + 1,
      });
    }
  }

  const genericChecklists = await ChecklistModel.find({
    $or: [{ cellType: { $exists: false } }, { cellType: null }, { cellType: '' }],
  })
    .sort({ name: 1 })
    .lean();

  for (const cl of genericChecklists) {
    const cellTypeLabel = cl.cellType ? formatCellTypeLabel(cl.cellType) : '';
    if (!cl.items?.length) {
      rows.push({
        checklistName: cl.name,
        cellType: cellTypeLabel,
        description: cl.description || '',
        itemName: '',
        itemOrder: 1,
      });
      continue;
    }
    for (const item of cl.items) {
      rows.push({
        checklistName: cl.name,
        cellType: cellTypeLabel,
        description: cl.description || '',
        itemName: item.itemName,
        itemOrder: (item.order ?? 0) + 1,
      });
    }
  }

  if (!rows.length) {
    return [
      {
        checklistName: 'BLOCK Cell Verification',
        cellType: 'BLOCK',
        description: 'Standard verification checklist for BLOCK layout cells',
        itemName: 'Floor plan completeness review',
        itemOrder: 1,
      },
      {
        checklistName: 'BLOCK Cell Verification',
        cellType: 'BLOCK',
        description: 'Standard verification checklist for BLOCK layout cells',
        itemName: 'Power strap verification',
        itemOrder: 2,
      },
      {
        checklistName: 'IO Cell Verification',
        cellType: 'IO',
        description: 'Standard verification checklist for IO pad ring cells',
        itemName: 'Pad ring alignment check',
        itemOrder: 1,
      },
      {
        checklistName: 'ESD Cell Verification',
        cellType: 'ESD',
        description: 'Standard verification checklist for ESD protection cells',
        itemName: 'ESD device sizing review',
        itemOrder: 1,
      },
      {
        checklistName: 'TOP Cell Verification',
        cellType: 'TOP',
        description: 'Standard verification checklist for top-level integration cells',
        itemName: 'Top-level integration review',
        itemOrder: 1,
      },
    ];
  }
  return rows;
}

async function resyncMappingsAfterChecklistDefinitionChange(checklistId: Types.ObjectId): Promise<void> {
  const checklist = await ChecklistModel.findById(checklistId);
  if (!checklist) return;

  const assignments = await ProjectChecklistModel.find({ checklistId });
  for (const assignment of assignments) {
    const projectId = assignment.projectId;
    const oldMappings = await CellChecklistMappingModel.find({ projectId, checklistId }).lean();
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

    for (const mapping of oldMappings) {
      const key = `${String(mapping.cellId)}::${mapping.itemName.toLowerCase()}`;
      preserved.set(key, {
        response: mapping.response ?? null,
        comment: mapping.comment ?? '',
        status: mapping.status,
        appliedBy: mapping.appliedBy,
        appliedByName: mapping.appliedByName,
        appliedDate: mapping.appliedDate,
      });
    }

    await CellChecklistMappingModel.deleteMany({ projectId, checklistId });

    const selectedNames = new Set(
      (assignment.selectedItemIds ?? [])
        .map((id) => checklist.items.find((item) => item._id.equals(id))?.itemName.toLowerCase())
        .filter(Boolean) as string[],
    );

    const nextSelectedIds = checklist.items
      .filter((item) => selectedNames.size === 0 || selectedNames.has(item.itemName.toLowerCase()))
      .map((item) => item._id);

    assignment.selectedItemIds = nextSelectedIds.length ? nextSelectedIds : checklist.items.map((i) => i._id);
    await assignment.save();

    const cells = await ProjectCellModel.find({ projectId });
    const bulk = [];
    for (const cell of cells) {
      for (const item of checklist.items) {
        if (
          assignment.selectedItemIds.length &&
          !assignment.selectedItemIds.some((id) => id.equals(item._id))
        ) {
          continue;
        }
        const prev = preserved.get(`${String(cell._id)}::${item.itemName.toLowerCase()}`);
        bulk.push({
          projectId,
          cellId: cell._id,
          checklistId,
          checklistItemId: item._id,
          itemName: item.itemName,
          status: prev?.status ?? 'Pending',
          response: prev?.response ?? null,
          comment: prev?.comment ?? '',
          appliedBy: prev?.appliedBy,
          appliedByName: prev?.appliedByName,
          appliedDate: prev?.appliedDate,
        });
      }
    }

    if (bulk.length) {
      await CellChecklistMappingModel.insertMany(bulk, { ordered: false });
    }
    await recalcProjectChecklistProgress(projectId);
  }
}

function rowChecklistName(row: Record<string, unknown>): string {
  return String(row.checklistName ?? row['Checklist Name'] ?? row['checklist name'] ?? '').trim();
}

export async function importChecklistTemplateRows(
  rows: Record<string, unknown>[],
  actor?: string,
): Promise<{
  imported: number;
  created: number;
  updated: number;
  failed: number;
  errors: { row: number; checklistName: string; message: string }[];
}> {
  let imported = 0;
  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: { row: number; checklistName: string; message: string }[] = [];

  type Group = {
    description: string;
    displayName: string;
    cellType?: string;
    items: { itemName: string; order: number }[];
  };
  const grouped = new Map<string, Group>();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    imported += 1;

    const checklistName = rowChecklistName(row);
    const cellTypeRaw = rowCellType(row);
    const normalizedCellType = cellTypeRaw ? normalizeChecklistCellType(cellTypeRaw) : null;
    const description = String(row.description ?? row['Description'] ?? '').trim();
    const itemName = String(row.itemName ?? row['Item Name'] ?? row['item name'] ?? '').trim();
    const orderRaw = row.itemOrder ?? row['Item Order'] ?? row['item order'] ?? '';

    if (!checklistName && !normalizedCellType) {
      failed += 1;
      errors.push({ row: i + 1, checklistName: '(empty)', message: 'Checklist name or cell type is required' });
      continue;
    }

    const key = normalizedCellType ?? checklistName.toLowerCase();
    if (!grouped.has(key)) {
      grouped.set(key, {
        description,
        displayName: checklistName || `${formatCellTypeLabel(normalizedCellType!)} Cell Verification`,
        cellType: normalizedCellType ?? undefined,
        items: [],
      });
    }

    const group = grouped.get(key)!;
    if (description) group.description = description;
    if (checklistName) group.displayName = checklistName;
    if (normalizedCellType) group.cellType = normalizedCellType;
    if (itemName) {
      const order = Number(orderRaw);
      group.items.push({
        itemName,
        order: Number.isFinite(order) && order > 0 ? order : group.items.length + 1,
      });
    }
  }

  for (const group of grouped.values()) {
    if (!group.items.length) {
      failed += 1;
      errors.push({
        row: 0,
        checklistName: group.displayName,
        message: 'At least one item name is required per checklist',
      });
      continue;
    }

    try {
      group.items.sort((a, b) => a.order - b.order);

      if (group.cellType && (CELL_TYPES as readonly string[]).includes(group.cellType)) {
        const hadDefinition = await CellTypeChecklistDefinitionModel.findOne({
          cellType: group.cellType,
        });
        await upsertCellTypeChecklistFromExcel(
          group.cellType as (typeof CELL_TYPES)[number],
          {
            checklistName: group.displayName,
            description: group.description,
            items: group.items,
          },
          actor,
        );
        if (hadDefinition) updated += 1;
        else created += 1;
        continue;
      }

      const itemDocs = group.items.map((item, idx) => ({
        _id: new Types.ObjectId(),
        itemName: item.itemName,
        order: idx,
      }));

      let doc = await ChecklistModel.findOne({
        name: new RegExp(`^${escapeRegex(group.displayName)}$`, 'i'),
      });

      if (doc) {
        doc.name = group.displayName;
        doc.description = group.description;
        doc.items = itemDocs;
        await doc.save();
        await resyncMappingsAfterChecklistDefinitionChange(doc._id);
        updated += 1;
      } else {
        await ChecklistModel.create({
          name: group.displayName,
          description: group.description,
          items: itemDocs,
          createdBy: actor,
        });
        created += 1;
      }
    } catch (err: any) {
      failed += 1;
      errors.push({
        row: 0,
        checklistName: group.displayName,
        message: err.message || 'Failed to save checklist',
      });
    }
  }
  return { imported, created, updated, failed, errors };
}

export { resyncMappingsAfterChecklistDefinitionChange };
