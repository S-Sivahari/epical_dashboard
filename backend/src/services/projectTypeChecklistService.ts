import ExcelJS from 'exceljs';
import { Types } from 'mongoose';
import { ProjectLibraryModel } from '../models/ProjectLibrary';
import { ProjectCellModel, CELL_TYPES, type CellType } from '../models/ProjectCell';
import { ProjectTypeChecklistModel } from '../models/ProjectTypeChecklist';
import { CellTypeChecklistResponseModel, type TypeChecklistAnswer } from '../models/CellTypeChecklistResponse';
import { CellCustomChecklistItemModel } from '../models/CellCustomChecklistItem';
import { CellHiddenChecklistItemModel } from '../models/CellHiddenChecklistItem';

export type ChecklistItemSource = 'template' | 'custom';

export interface ParsedChecklistItem {
  itemIndex: number;
  itemName: string;
}

export function normalizeCellType(value: string): CellType {
  const trimmed = String(value || '').trim();
  if ((CELL_TYPES as readonly string[]).includes(trimmed)) return trimmed as CellType;
  const match = CELL_TYPES.find((type) => type.toLowerCase() === trimmed.toLowerCase());
  return (match ?? 'block') as CellType;
}

export function toProjectObjectId(projectId: string): Types.ObjectId | null {
  if (!Types.ObjectId.isValid(projectId)) return null;
  return new Types.ObjectId(projectId);
}

export function bufferFromStoredFile(fileData: unknown): Buffer | null {
  if (!fileData) return null;
  if (Buffer.isBuffer(fileData)) return fileData.length ? fileData : null;
  if (fileData instanceof Uint8Array) return fileData.length ? Buffer.from(fileData) : null;
  if (typeof fileData === 'object' && fileData !== null) {
    const record = fileData as { type?: string; data?: number[]; buffer?: ArrayBuffer };
    if (record.type === 'Buffer' && Array.isArray(record.data)) {
      const buf = Buffer.from(record.data);
      return buf.length ? buf : null;
    }
    if (record.buffer) {
      const buf = Buffer.from(record.buffer);
      return buf.length ? buf : null;
    }
  }
  return null;
}

export async function resolveCellContext(projectId: string, cellId: string) {
  const projectObjectId = toProjectObjectId(projectId);
  if (!projectObjectId || !Types.ObjectId.isValid(cellId)) return null;

  const cell = await ProjectCellModel.findOne({
    _id: new Types.ObjectId(cellId),
    projectId: projectObjectId,
  }).lean();

  if (!cell) return null;

  const library = await ProjectLibraryModel.findOne({
    _id: cell.libraryId,
    projectId: projectObjectId,
  }).lean();

  const cellType = normalizeCellType(cell.cellType);

  return {
    cell,
    library,
    cellType,
    projectObjectId,
    cellObjectId: new Types.ObjectId(cellId),
  };
}

export async function findTypeChecklistDoc(projectId: Types.ObjectId | string, cellType: CellType) {
  const pid = typeof projectId === 'string' ? toProjectObjectId(projectId) : projectId;
  if (!pid) return null;
  return ProjectTypeChecklistModel.findOne({ projectId: pid, cellType }).lean();
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value == null) return '';
  if (typeof value === 'object' && 'text' in value && typeof (value as { text?: string }).text === 'string') {
    return String((value as { text: string }).text).trim();
  }
  if (typeof value === 'object' && 'richText' in value && Array.isArray((value as { richText: { text: string }[] }).richText)) {
    return (value as { richText: { text: string }[] }).richText.map((part) => part.text).join('').trim();
  }
  return String(value).trim();
}

export async function parseChecklistItemsFromBuffer(buffer: Buffer): Promise<ParsedChecklistItem[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  let itemColumn = 1;
  const headerCells = Math.max(headerRow.cellCount, 6);

  for (let col = 1; col <= headerCells; col += 1) {
    const header = cellText(headerRow.getCell(col)).toLowerCase();
    if (header === 'item' || header === 'question' || header.includes('checklist item')) {
      itemColumn = col;
      break;
    }
  }

  const firstCell = cellText(headerRow.getCell(itemColumn)).toLowerCase();
  const skipFirstRow =
    firstCell === 'item' ||
    firstCell === 'question' ||
    firstCell.includes('checklist');

  const items: ParsedChecklistItem[] = [];
  let itemIndex = 0;

  sheet.eachRow((row, rowNumber) => {
    if (skipFirstRow && rowNumber === 1) return;
    const raw = cellText(row.getCell(itemColumn));
    if (!raw) return;
    items.push({ itemIndex, itemName: raw });
    itemIndex += 1;
  });

  return items;
}

export async function getTypeChecklistItems(
  projectId: Types.ObjectId | string,
  cellType: CellType,
): Promise<ParsedChecklistItem[]> {
  const doc = await findTypeChecklistDoc(projectId, cellType);
  const buffer = bufferFromStoredFile(doc?.fileData);
  if (!buffer) return [];
  return parseChecklistItemsFromBuffer(buffer);
}

export function formatChecklistAnswerLabel(response: TypeChecklistAnswer | null): string {
  if (response === 'yes') return 'Yes';
  if (response === 'no') return 'No';
  if (response === 'not_applicable') return 'Not applicable';
  return 'Pending';
}

export async function buildCellChecklistItems(context: Awaited<ReturnType<typeof resolveCellContext>>) {
  if (!context) return [];

  const { cellType, projectObjectId, cellObjectId } = context;
  const typeDoc = await findTypeChecklistDoc(projectObjectId, cellType);
  const buffer = bufferFromStoredFile(typeDoc?.fileData);

  const [hiddenRows, customRows, savedRows] = await Promise.all([
    CellHiddenChecklistItemModel.find({ cellId: cellObjectId }).lean(),
    CellCustomChecklistItemModel.find({ cellId: cellObjectId }).sort({ sortOrder: 1, createdAt: 1 }).lean(),
    CellTypeChecklistResponseModel.find({ cellId: cellObjectId }).lean(),
  ]);

  const hiddenIndices = new Set(hiddenRows.map((row) => row.itemIndex));
  const savedByIndex = new Map(savedRows.map((row) => [row.itemIndex, row]));

  const templateItems = buffer
    ? (await parseChecklistItemsFromBuffer(buffer))
        .filter((item) => !hiddenIndices.has(item.itemIndex))
        .map((item) => {
          const row = savedByIndex.get(item.itemIndex);
          return {
            source: 'template' as ChecklistItemSource,
            itemKey: `template-${item.itemIndex}`,
            itemIndex: item.itemIndex,
            customItemId: null as string | null,
            itemName: item.itemName,
            response: row?.response ?? null,
            comment: row?.comment ?? '',
            answeredAt: row?.answeredAt ?? null,
            answeredByName: row?.answeredByName ?? '',
          };
        })
    : [];

  const customItems = customRows.map((row) => ({
    source: 'custom' as ChecklistItemSource,
    itemKey: `custom-${row._id.toString()}`,
    itemIndex: null as number | null,
    customItemId: row._id.toString(),
    itemName: row.itemName,
    response: row.response ?? null,
    comment: row.comment ?? '',
    answeredAt: row.answeredAt ?? null,
    answeredByName: row.answeredByName ?? '',
  }));

  return [...templateItems, ...customItems];
}

export async function getCellTypeChecklistDetail(projectId: string, cellId: string) {
  const context = await resolveCellContext(projectId, cellId);
  if (!context) return null;

  const { cell, library, cellType, projectObjectId, cellObjectId } = context;
  const typeDoc = await findTypeChecklistDoc(projectObjectId, cellType);
  const buffer = bufferFromStoredFile(typeDoc?.fileData);
  const items = await buildCellChecklistItems(context);

  return {
    cellId: cellObjectId.toString(),
    libraryId: cell.libraryId.toString(),
    libraryName: library?.name ?? '',
    cellName: cell.name,
    cellType,
    fileName: typeDoc?.fileName ?? '',
    hasFile: !!buffer,
    uploadedAt: typeDoc?.uploadedAt ?? null,
    items,
  };
}

export async function addCustomChecklistItem(
  projectId: string,
  cellId: string,
  itemName: string,
  actor: { userId: string; userName: string },
) {
  const context = await resolveCellContext(projectId, cellId);
  if (!context) return null;

  const trimmed = itemName.trim();
  if (!trimmed) return null;

  const count = await CellCustomChecklistItemModel.countDocuments({ cellId: context.cellObjectId });
  const doc = await CellCustomChecklistItemModel.create({
    projectId: context.projectObjectId,
    cellId: context.cellObjectId,
    cellType: context.cellType,
    itemName: trimmed,
    sortOrder: count,
    createdById: actor.userId,
    createdByName: actor.userName,
  });

  return {
    source: 'custom' as ChecklistItemSource,
    itemKey: `custom-${doc._id.toString()}`,
    itemIndex: null,
    customItemId: doc._id.toString(),
    itemName: doc.itemName,
    response: null,
    comment: '',
    answeredAt: null,
    answeredByName: '',
  };
}

export async function deleteChecklistItem(
  projectId: string,
  cellId: string,
  itemKey: string,
  actor: { userId: string; userName: string },
): Promise<'custom' | 'template' | null> {
  const context = await resolveCellContext(projectId, cellId);
  if (!context) return null;

  if (itemKey.startsWith('custom-')) {
    const customItemId = itemKey.slice('custom-'.length);
    if (!Types.ObjectId.isValid(customItemId)) return null;
    const result = await CellCustomChecklistItemModel.findOneAndDelete({
      _id: new Types.ObjectId(customItemId),
      cellId: context.cellObjectId,
    });
    return result ? 'custom' : null;
  }

  if (itemKey.startsWith('template-')) {
    const itemIndex = Number(itemKey.slice('template-'.length));
    if (!Number.isInteger(itemIndex) || itemIndex < 0) return null;

    await CellHiddenChecklistItemModel.findOneAndUpdate(
      { cellId: context.cellObjectId, itemIndex },
      {
        cellId: context.cellObjectId,
        itemIndex,
        hiddenById: actor.userId,
        hiddenByName: actor.userName,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await CellTypeChecklistResponseModel.deleteOne({
      cellId: context.cellObjectId,
      itemIndex,
    });
    return 'template';
  }

  return null;
}

export async function updateCustomChecklistItemResponse(
  projectId: string,
  cellId: string,
  customItemId: string,
  payload: { response: TypeChecklistAnswer; comment: string },
  actor: { userId: string; userName: string },
) {
  const context = await resolveCellContext(projectId, cellId);
  if (!context || !Types.ObjectId.isValid(customItemId)) return null;

  const doc = await CellCustomChecklistItemModel.findOneAndUpdate(
    { _id: new Types.ObjectId(customItemId), cellId: context.cellObjectId },
    {
      response: payload.response,
      comment: payload.comment,
      answeredById: actor.userId,
      answeredByName: actor.userName,
      answeredAt: new Date(),
    },
    { new: true },
  );

  if (!doc) return null;

  return {
    source: 'custom' as ChecklistItemSource,
    itemKey: `custom-${doc._id.toString()}`,
    itemIndex: null,
    customItemId: doc._id.toString(),
    itemName: doc.itemName,
    response: doc.response,
    comment: doc.comment,
    answeredAt: doc.answeredAt,
    answeredByName: doc.answeredByName ?? '',
  };
}

export async function buildCellChecklistWorkbook(projectId: string, cellId: string) {
  const detail = await getCellTypeChecklistDetail(projectId, cellId);
  if (!detail) return null;

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Checklist');
  sheet.columns = [
    { header: 'Item', key: 'item', width: 50 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Notes', key: 'notes', width: 40 },
  ];

  for (const item of detail.items) {
    sheet.addRow({
      item: item.itemName,
      status: formatChecklistAnswerLabel(item.response),
      notes: item.comment || '',
    });
  }

  sheet.getRow(1).font = { bold: true };
  const buffer = await wb.xlsx.writeBuffer();
  const safeCellName = detail.cellName.replace(/[^\w.-]+/g, '_') || 'cell';
  const fileName = `${detail.cellType}-${safeCellName}-checklist.xlsx`;

  return { buffer: Buffer.from(buffer), fileName, detail };
}

export async function clearResponsesForType(
  projectId: Types.ObjectId | string,
  cellType: CellType,
): Promise<void> {
  const pid = typeof projectId === 'string' ? toProjectObjectId(projectId) : projectId;
  if (!pid) return;

  const cells = await ProjectCellModel.find({ projectId: pid, cellType }).select('_id').lean();
  const cellIds = cells.map((cell) => cell._id);

  await Promise.all([
    CellTypeChecklistResponseModel.deleteMany({ projectId: pid, cellType }),
    cellIds.length
      ? CellHiddenChecklistItemModel.deleteMany({ cellId: { $in: cellIds } })
      : Promise.resolve(),
  ]);
}

export async function clearResponsesForCell(cellId: Types.ObjectId | string): Promise<void> {
  await Promise.all([
    CellTypeChecklistResponseModel.deleteMany({ cellId }),
    CellCustomChecklistItemModel.deleteMany({ cellId }),
    CellHiddenChecklistItemModel.deleteMany({ cellId }),
  ]);
}

export function isValidTypeChecklistAnswer(value: string): value is TypeChecklistAnswer {
  return value === 'yes' || value === 'no' || value === 'not_applicable';
}

export function commentRequiredForAnswer(response: TypeChecklistAnswer | null): boolean {
  return response === 'no' || response === 'not_applicable';
}
