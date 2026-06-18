import ExcelJS from 'exceljs';
import { Types } from 'mongoose';
import { ProjectModel } from '../models/Project';
import { ProjectCellModel } from '../models/ProjectCell';
import { ProjectLibraryModel } from '../models/ProjectLibrary';
import { syncChecklistMappingsForCell } from './checklistService';
import {
  normalizeComplexity,
  predictEffort,
  resolveBaseHoursInput,
} from './effortEstimationService';
import { normalizeCellType } from './projectTypeChecklistService';
import {
  defaultCellWorkflow,
  defaultViewWorkflow,
  normalizeCellWorkflow,
} from '../utils/cellWorkflow';
import { ensureWorkLogsInitialized } from './cellWorkflowWorkLogService';

export type ParsedCellImportRow = {
  rowNumber: number;
  name: string;
  cellType: string;
};

function getCellValue(row: ExcelJS.Row, index: number): string {
  const cell = row.getCell(index);
  const value = cell.value;
  if (value == null) return '';
  if (typeof value === 'object' && value !== null && 'text' in value) {
    return String((value as { text?: string }).text ?? '').trim();
  }
  return String(value).trim();
}

function findHeaderIndexes(headerRow: ExcelJS.Row): Record<string, number> {
  const indexes: Record<string, number> = {};
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const label = String(cell.value ?? '').trim().toLowerCase();
    if (!label) return;
    if (label === 'cell name' || label === 'name') indexes.name = colNumber;
    if (label === 'type' || label === 'cell type') indexes.type = colNumber;
    if (label === 'assigned to' || label === 'assigned') indexes.assigned = colNumber;
    if (label === 'status') indexes.status = colNumber;
  });
  return indexes;
}

export async function buildCellImportTemplateBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Cells');
  sheet.columns = [
    { header: 'Cell Name', key: 'name', width: 28 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Assigned To', key: 'assignedTo', width: 22 },
    { header: 'Status', key: 'status', width: 16 },
  ];
  sheet.addRow({
    name: 'Example cell',
    type: 'block',
    assignedTo: '',
    status: 'Not Started',
  });
  sheet.getRow(1).font = { bold: true };
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function parseCellImportWorkbook(buffer: Buffer): Promise<ParsedCellImportRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) {
    throw new Error('Workbook has no sheets');
  }

  const headerRow = sheet.getRow(1);
  const indexes = findHeaderIndexes(headerRow);
  if (!indexes.name || !indexes.type) {
    throw new Error('Template must include "Cell Name" and "Type" columns');
  }

  const rows: ParsedCellImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = getCellValue(row, indexes.name);
    const cellType = getCellValue(row, indexes.type);
    if (!name && !cellType) return;
    if (!name) {
      throw new Error(`Row ${rowNumber}: Cell name is required`);
    }
    if (!cellType) {
      throw new Error(`Row ${rowNumber}: Type is required`);
    }
    rows.push({ rowNumber, name, cellType });
  });

  if (rows.length === 0) {
    throw new Error('No cell rows found in the uploaded file');
  }

  return rows;
}

export async function importCellsForLibrary(params: {
  projectId: Types.ObjectId;
  libraryId: Types.ObjectId;
  rows: ParsedCellImportRow[];
  actor: { userId: string; userName: string };
}): Promise<{ created: number; skipped: number }> {
  const { projectId, libraryId, rows, actor } = params;
  const project = await ProjectModel.findById(projectId);
  const library = await ProjectLibraryModel.findOne({ _id: libraryId, projectId });
  if (!project || !library) {
    throw new Error('Project or library not found');
  }

  const existingNames = new Set(
    (await ProjectCellModel.find({ projectId, libraryId }).select('name').lean()).map((cell) =>
      String(cell.name).trim().toLowerCase(),
    ),
  );

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const normalizedName = row.name.trim();
    const nameKey = normalizedName.toLowerCase();
    if (existingNames.has(nameKey)) {
      skipped += 1;
      continue;
    }

    const normalizedComplexity = normalizeComplexity('Medium');
    const resolvedTechNode = project.technologyNode || '';
    const resolvedBaseHours = resolveBaseHoursInput(undefined, undefined, normalizedComplexity);
    const prediction = await predictEffort({
      cellType: normalizeCellType(row.cellType),
      technologyNode: resolvedTechNode,
      complexity: normalizedComplexity,
      baseHours: resolvedBaseHours,
    });

    const cell = await ProjectCellModel.create({
      projectId,
      libraryId,
      name: normalizedName,
      description: '',
      cellType: normalizeCellType(row.cellType),
      technologyNode: resolvedTechNode,
      complexity: normalizedComplexity,
      baseHours: prediction.baseHours,
      estimatedEffort: prediction.estimatedHours,
      smartEstimate: prediction.smartEstimate,
      estimateConfidence: prediction.confidence,
      actualEffort: 0,
      assignedEmployeeId: undefined,
      assignedEmployeeName: undefined,
      dependencyCellIds: [],
      status: 'ready',
      workflow: defaultCellWorkflow(),
      views: { layout: '', symbol: '', schematic: '' },
      viewWorkflow: defaultViewWorkflow(),
      activityLog: [
        {
          action: 'created',
          detail: `Cell "${normalizedName}" imported`,
          userId: actor.userId,
          userName: actor.userName,
          at: new Date(),
        },
      ],
      createdBy: actor.userId,
    });

    existingNames.add(nameKey);
    created += 1;

    await syncChecklistMappingsForCell(projectId, cell._id);
    await ensureWorkLogsInitialized(
      projectId.toString(),
      cell._id.toString(),
      {
        status: cell.status,
        onHold: cell.onHold,
        assignedEmployeeId: cell.assignedEmployeeId,
        workflow: normalizeCellWorkflow(cell.workflow),
      },
      cell.activityLog ?? [],
    );
  }

  return { created, skipped };
}
