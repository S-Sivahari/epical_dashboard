import { Types } from 'mongoose';
import {
  ChecklistModel,
  CellChecklistMappingModel,
} from '../models/Checklist';
import { ProjectModel } from '../models/Project';
import { ProjectCellModel } from '../models/ProjectCell';
import { ProjectLibraryModel } from '../models/ProjectLibrary';
import {
  syncChecklistMappingsForCell,
  updateCellChecklistItemResponse,
} from './checklistService';

export interface ProjectCellChecklistExportRow {
  cellName: string;
  library: string;
  cellType: string;
  checklistName: string;
  itemName: string;
  itemOrder: number | string;
  response: string;
  comment: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeResponse(value: string): 'yes' | 'no' | 'not_applicable' | null {
  const raw = value.trim().toLowerCase();
  if (!raw || raw === '—' || raw === '-') return null;
  if (['yes', 'y'].includes(raw)) return 'yes';
  if (['no', 'n'].includes(raw)) return 'no';
  if (['n/a', 'na', 'not applicable', 'not_applicable', 'notapplicable'].includes(raw)) {
    return 'not_applicable';
  }
  return null;
}

function formatCellTypeLabel(cellType: string): string {
  const labels: Record<string, string> = {
    block: 'BLOCK',
    IOP: 'IO',
    ESD: 'ESD',
    TOP: 'TOP',
  };
  return labels[cellType] ?? cellType;
}

function formatResponseLabel(response?: string | null): string {
  if (response === 'yes') return 'Yes';
  if (response === 'no') return 'No';
  if (response === 'not_applicable') return 'N/A';
  return '';
}

export async function buildProjectCellChecklistExportRows(
  projectId: string,
): Promise<ProjectCellChecklistExportRow[]> {
  if (!Types.ObjectId.isValid(projectId)) {
    throw new Error('Invalid project id');
  }

  const projectOid = new Types.ObjectId(projectId);
  const project = await ProjectModel.findById(projectOid);
  if (!project) throw new Error('Project not found');

  const [cells, libraries] = await Promise.all([
    ProjectCellModel.find({ projectId: projectOid }).sort({ name: 1 }).lean(),
    ProjectLibraryModel.find({ projectId: projectOid }).lean(),
  ]);

  const libraryMap = new Map(libraries.map((lib) => [String(lib._id), lib.name]));

  for (const cell of cells) {
    await syncChecklistMappingsForCell(projectOid, cell._id);
  }

  const rows: ProjectCellChecklistExportRow[] = [];

  for (const cell of cells) {
    const entries = await CellChecklistMappingModel.find({
      projectId: projectOid,
      cellId: cell._id,
    })
      .sort({ itemName: 1 })
      .lean();

    const checklist = entries[0]?.checklistId
      ? await ChecklistModel.findById(entries[0].checklistId).lean()
      : null;

    const checklistName = checklist?.name ?? '';
    const orderByItemId = new Map(
      (checklist?.items ?? []).map((item) => [String(item._id), (item.order ?? 0) + 1]),
    );

    if (!entries.length) {
      rows.push({
        cellName: cell.name,
        library: libraryMap.get(String(cell.libraryId)) ?? '',
        cellType: formatCellTypeLabel(cell.cellType),
        checklistName,
        itemName: '',
        itemOrder: '',
        response: '',
        comment: '',
      });
      continue;
    }

    for (const entry of entries) {
      rows.push({
        cellName: cell.name,
        library: libraryMap.get(String(cell.libraryId)) ?? '',
        cellType: formatCellTypeLabel(cell.cellType),
        checklistName,
        itemName: entry.itemName,
        itemOrder: orderByItemId.get(String(entry.checklistItemId)) ?? '',
        response: formatResponseLabel(entry.response),
        comment: entry.comment ?? '',
      });
    }
  }

  return rows;
}

export async function importProjectCellChecklistRows(
  projectId: string,
  rows: Record<string, unknown>[],
  actorId: string,
  actorName: string,
): Promise<{
  imported: number;
  updated: number;
  failed: number;
  errors: { row: number; cellName: string; message: string }[];
}> {
  if (!Types.ObjectId.isValid(projectId)) {
    throw new Error('Invalid project id');
  }

  const projectOid = new Types.ObjectId(projectId);
  const project = await ProjectModel.findById(projectOid);
  if (!project) throw new Error('Project not found');

  let imported = 0;
  let updated = 0;
  let failed = 0;
  const errors: { row: number; cellName: string; message: string }[] = [];

  const cells = await ProjectCellModel.find({ projectId: projectOid });
  for (const cell of cells) {
    await syncChecklistMappingsForCell(projectOid, cell._id);
  }

  const cellByName = new Map(cells.map((cell) => [cell.name.trim().toLowerCase(), cell]));

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    imported += 1;

    const cellName = String(row.cellName ?? row['Cell Name'] ?? '').trim();
    const itemName = String(row.itemName ?? row['Item Name'] ?? '').trim();
    const responseRaw = String(row.response ?? row.Response ?? '').trim();
    const comment = String(row.comment ?? row.Comment ?? '').trim();

    if (!cellName) {
      failed += 1;
      errors.push({ row: i + 1, cellName: '(empty)', message: 'Cell name is required' });
      continue;
    }

    if (!itemName) {
      continue;
    }

    const cell = cellByName.get(cellName.toLowerCase());
    if (!cell) {
      failed += 1;
      errors.push({ row: i + 1, cellName, message: 'Cell not found in this project' });
      continue;
    }

    const mapping = await CellChecklistMappingModel.findOne({
      projectId: projectOid,
      cellId: cell._id,
      itemName: new RegExp(`^${escapeRegex(itemName)}$`, 'i'),
    });

    if (!mapping) {
      failed += 1;
      errors.push({
        row: i + 1,
        cellName,
        message: `Checklist item "${itemName}" not found for this cell`,
      });
      continue;
    }

    const response = normalizeResponse(responseRaw);
    if (!response) {
      if (responseRaw) {
        failed += 1;
        errors.push({
          row: i + 1,
          cellName,
          message: 'Response must be Yes, No, or N/A',
        });
      }
      continue;
    }

    try {
      await updateCellChecklistItemResponse(
        projectId,
        String(cell._id),
        String(mapping._id),
        { response, comment },
        actorId,
        actorName,
      );
      updated += 1;
    } catch (err: any) {
      failed += 1;
      errors.push({
        row: i + 1,
        cellName,
        message: err.message || 'Failed to update checklist item',
      });
    }
  }

  return { imported, updated, failed, errors };
}
