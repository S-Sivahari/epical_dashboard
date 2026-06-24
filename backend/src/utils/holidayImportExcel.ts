import ExcelJS from 'exceljs';
import type { HolidayType } from '../services/leaveService';

export const HOLIDAY_IMPORT_HEADERS = [
  'From Date',
  'To Date',
  'Holiday Name',
  'Holiday Type',
] as const;

export const HOLIDAY_TYPE_OPTIONS = [
  'Public Holiday',
  'Company Holiday',
  'Company Event',
] as const;

/** Matches site --dash-forest (#1a4329) used on calendar/dashboard headers */
const BRAND_GREEN_ARGB = 'FF1A4329';
const HEADER_ROW = 1;
const FIRST_DATA_ROW = 2;
const IMPORT_TEMPLATE_DATA_ROWS = 200;

const COLUMN_KEYS = {
  fromDate: 'From Date',
  toDate: 'To Date',
  holidayName: 'Holiday Name',
  holidayType: 'Holiday Type',
} as const;

type ColumnKey = keyof typeof COLUMN_KEYS;

const HEADER_ALIASES: Record<string, ColumnKey> = {
  fromdate: 'fromDate',
  startdate: 'fromDate',
  todate: 'toDate',
  enddate: 'toDate',
  holidayname: 'holidayName',
  name: 'holidayName',
  title: 'holidayName',
  holidaytype: 'holidayType',
  type: 'holidayType',
};

export type ParsedHolidayImportRow = {
  rowNumber: number;
  fromDate: string;
  toDate: string | null;
  title: string;
  type: HolidayType;
  errors: string[];
};

export type HolidayImportSummaryItem = {
  title: string;
  typeLabel: string;
  fromDate: string;
  toDate: string | null;
};

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

function formatDisplayDate(value: string): string {
  const date = parseIsoDate(value);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function excelCellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) {
    return formatIsoDate(value);
  }
  if (typeof value === 'object' && 'richText' in value) {
    return (value as ExcelJS.CellRichTextValue).richText.map((part) => part.text).join('').trim();
  }
  if (typeof value === 'object' && 'result' in value) {
    const result = (value as ExcelJS.CellFormulaValue).result;
    return result == null ? '' : String(result).trim();
  }
  if (typeof value === 'object' && 'text' in value) {
    return String((value as { text: string }).text).trim();
  }
  return String(value).trim();
}

function parseDateCell(value: ExcelJS.CellValue): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatIsoDate(value);
  }
  const text = excelCellText(value);
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return formatIsoDate(parsed);
  return text;
}

function columnLetter(col: number): string {
  let letter = '';
  let n = col;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

function headerColumn(header: (typeof HOLIDAY_IMPORT_HEADERS)[number]): number {
  return HOLIDAY_IMPORT_HEADERS.indexOf(header) + 1;
}

function writeListColumn(sheet: ExcelJS.Worksheet, col: number, values: readonly string[]): string {
  values.forEach((value, index) => {
    sheet.getCell(index + 1, col).value = value;
  });
  const letter = columnLetter(col);
  return `Lists!$${letter}$1:$${letter}$${values.length}`;
}

function applyListValidation(
  sheet: ExcelJS.Worksheet,
  col: number,
  listRange: string,
  fromRow: number,
  toRow: number,
) {
  const letter = columnLetter(col);
  sheet.dataValidations.add(`${letter}${fromRow}:${letter}${toRow}`, {
    type: 'list',
    allowBlank: false,
    formulae: [listRange],
    showErrorMessage: true,
    errorStyle: 'error',
    errorTitle: 'Invalid value',
    error: 'Choose Public Holiday, Company Holiday, or Company Event.',
  });
}

function findHeaderRow(sheet: ExcelJS.Worksheet): number {
  let headerRow = 0;
  sheet.eachRow((row, rowNumber) => {
    if (headerRow > 0) return;
    const cells: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      cells.push(normalizeHeader(excelCellText(cell.value)));
    });
    if (cells.some((c) => c.includes('fromdate') || c.includes('holidayname'))) {
      headerRow = rowNumber;
    }
  });
  return headerRow;
}

function buildColumnIndex(headerRow: ExcelJS.Row): Map<number, ColumnKey> {
  const map = new Map<number, ColumnKey>();
  headerRow.eachCell((cell, colNumber) => {
    const normalized = normalizeHeader(excelCellText(cell.value));
    if (!normalized) return;
    if (HEADER_ALIASES[normalized]) {
      map.set(colNumber, HEADER_ALIASES[normalized]);
      return;
    }
    for (const [key, label] of Object.entries(COLUMN_KEYS)) {
      if (normalizeHeader(label) === normalized) {
        map.set(colNumber, key as ColumnKey);
      }
    }
  });
  return map;
}

function resolveHolidayImportSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  const holidaysSheet = wb.getWorksheet('Holidays');
  if (holidaysSheet) return holidaysSheet;

  for (const sheet of wb.worksheets) {
    if (findHeaderRow(sheet) > 0) return sheet;
  }

  return wb.worksheets[0];
}

export function mapHolidayTypeLabel(value: string): HolidayType | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'public holiday' || normalized === 'national') return 'National';
  if (normalized === 'company holiday' || normalized === 'company') return 'Company';
  if (normalized === 'company event') return 'Company Event';
  if (normalized === 'optional') return 'Optional';
  return null;
}

export function holidayTypeToLabel(type: HolidayType): string {
  switch (type) {
    case 'National':
      return 'Public Holiday';
    case 'Company':
      return 'Company Holiday';
    case 'Company Event':
      return 'Company Event';
    default:
      return type;
  }
}

function isEmptyRow(values: Record<ColumnKey, string>): boolean {
  return (
    !values.fromDate.trim() &&
    !values.toDate.trim() &&
    !values.holidayName.trim() &&
    !values.holidayType.trim()
  );
}

function validateRow(values: Record<ColumnKey, string>): string[] {
  const errors: string[] = [];
  const fromDate = values.fromDate.trim();
  const toDate = values.toDate.trim();
  const title = values.holidayName.trim();
  const typeRaw = values.holidayType.trim();

  if (!fromDate) errors.push('From Date is required');
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) errors.push('From Date must be a valid date (YYYY-MM-DD)');

  if (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    errors.push('To Date must be a valid date (YYYY-MM-DD)');
  }

  if (fromDate && toDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate) && /^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    if (parseIsoDate(toDate).getTime() < parseIsoDate(fromDate).getTime()) {
      errors.push('To Date cannot be earlier than From Date');
    }
  }

  if (!title) errors.push('Holiday Name is required');
  if (!typeRaw) errors.push('Holiday Type is required');
  else if (!mapHolidayTypeLabel(typeRaw)) {
    errors.push('Holiday Type must be Public Holiday, Company Holiday, or Company Event');
  }

  return errors;
}

export function expandHolidayDates(fromDate: string, toDate: string | null): string[] {
  const start = parseIsoDate(fromDate);
  const end = toDate ? parseIsoDate(toDate) : start;
  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(formatIsoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export async function buildHolidayImportTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EPICAL HRMS';
  wb.created = new Date();

  const listsSheet = wb.addWorksheet('Lists');
  listsSheet.state = 'veryHidden';
  const holidayTypeList = writeListColumn(listsSheet, 1, HOLIDAY_TYPE_OPTIONS);

  const sheet = wb.addWorksheet('Holidays');
  sheet.addRow([...HOLIDAY_IMPORT_HEADERS]);
  const header = sheet.getRow(HEADER_ROW);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: BRAND_GREEN_ARGB },
  };
  header.alignment = { horizontal: 'center', vertical: 'middle' };
  header.height = 24;

  sheet.getColumn(1).width = 14;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 28;
  sheet.getColumn(4).width = 20;

  const lastDataRow = FIRST_DATA_ROW + IMPORT_TEMPLATE_DATA_ROWS - 1;
  const fromCol = headerColumn('From Date');
  const toCol = headerColumn('To Date');
  const typeCol = headerColumn('Holiday Type');

  for (let row = FIRST_DATA_ROW; row <= lastDataRow; row += 1) {
    sheet.getCell(row, fromCol).numFmt = 'dd/mm/yyyy';
    sheet.getCell(row, toCol).numFmt = 'dd/mm/yyyy';
  }

  applyListValidation(sheet, typeCol, holidayTypeList, FIRST_DATA_ROW, lastDataRow);
  sheet.views = [{ state: 'frozen', ySplit: HEADER_ROW }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function parseHolidayImportWorkbook(buffer: Buffer): Promise<ParsedHolidayImportRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = resolveHolidayImportSheet(wb);
  if (!sheet) {
    throw new Error('Worksheet not found');
  }

  const headerRowNumber = findHeaderRow(sheet);
  if (!headerRowNumber) {
    throw new Error('Could not find header row. Use the downloaded holiday import template.');
  }

  const columnIndex = buildColumnIndex(sheet.getRow(headerRowNumber));
  if (!columnIndex.size) {
    throw new Error('No recognizable holiday columns found in the uploaded file.');
  }

  const rows: ParsedHolidayImportRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;

    const values = {
      fromDate: '',
      toDate: '',
      holidayName: '',
      holidayType: '',
    } satisfies Record<ColumnKey, string>;

    columnIndex.forEach((key, colNumber) => {
      const cell = row.getCell(colNumber);
      if (key === 'fromDate' || key === 'toDate') {
        values[key] = parseDateCell(cell.value);
      } else {
        values[key] = excelCellText(cell.value);
      }
    });

    if (isEmptyRow(values)) return;

    const errors = validateRow(values);
    const mappedType = mapHolidayTypeLabel(values.holidayType);

    rows.push({
      rowNumber,
      fromDate: values.fromDate.trim(),
      toDate: values.toDate.trim() || null,
      title: values.holidayName.trim(),
      type: mappedType ?? 'National',
      errors,
    });
  });

  return rows;
}

export function formatHolidaySummaryDate(fromDate: string, toDate: string | null): string {
  if (!toDate || toDate === fromDate) return formatDisplayDate(fromDate);
  return `${formatDisplayDate(fromDate)} – ${formatDisplayDate(toDate)}`;
}
