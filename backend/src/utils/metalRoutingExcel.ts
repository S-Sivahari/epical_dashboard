import ExcelJS from 'exceljs';

export interface ParsedRouteMetalRow {
  metalType: string;
  width: number;
  length: number;
}

export interface ParsedRouteBlock {
  fromCell: string;
  toCell: string;
  fromSignal: string;
  toSignal: string;
  metals: ParsedRouteMetalRow[];
}

export interface ParseMetalRoutingDiagnostics {
  worksheetName: string;
  headerRow: number;
  mergeRangeCount: number;
  dataRowsScanned: number;
  routeBlocks: ParsedRouteBlock[];
  totalMetalRows: number;
}

const LOG_PREFIX = '[metal-routing-excel]';

export interface RouteExcelRecord {
  fromCell: string;
  toCell: string;
  fromSignal: string;
  toSignal: string;
  metals: Array<{
    metalType: string;
    width: number;
    length: number;
    givenCurrentDensity: number;
    implementedCurrentMetalCapacity: number;
    routingMetalImpedance: number;
  }>;
  minimumMetalCurrentCapacity: number;
  totalImpedance: number;
}

type RouteColumnKey =
  | 'fromToCell'
  | 'fromSignal'
  | 'toSignal'
  | 'metalType'
  | 'width'
  | 'length'
  | 'givenDensity'
  | 'implementedCapacity'
  | 'minCapacity'
  | 'routingImpedance'
  | 'totalImpedance';

const REQUIRED_IMPORT_COLUMNS: RouteColumnKey[] = [
  'fromToCell',
  'fromSignal',
  'toSignal',
  'metalType',
  'width',
  'length',
];

const HEADERS: Record<RouteColumnKey, string> = {
  fromToCell: 'From Cell & To Cell',
  fromSignal: 'From Signal (Name)',
  toSignal: 'To Signal (Name)',
  metalType: 'Metal Type',
  width: 'Metal Width(µm)',
  length: 'Metal Length(µm)',
  givenDensity: 'Given Current Density (mA)',
  implementedCapacity: 'Implemented Metal Current Capability(mA)',
  minCapacity: 'Minimum Metal Current Capability(mA)',
  routingImpedance: 'Routing Metal Impedence(mΩ)',
  totalImpedance: 'Total Impedence(mΩ)',
};

const COL_ORDER: RouteColumnKey[] = [
  'fromToCell',
  'fromSignal',
  'toSignal',
  'metalType',
  'width',
  'length',
  'givenDensity',
  'implementedCapacity',
  'minCapacity',
  'routingImpedance',
  'totalImpedance',
];

const COLORS = {
  headerYellow: 'FFFDE047',
  dataLime: 'FF86EFAC',
  dataLimeStrong: 'FFA3E635',
  black: 'FF000000',
  white: 'FFFFFFFF',
};

function excelCellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
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

function normalizeHeader(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function classifyColumn(header: string): RouteColumnKey | null {
  const h = normalizeHeader(header.replace(/&/g, ' '));
  const compact = h.replace(/\s+/g, '');

  if (h.includes('from cell') && h.includes('to cell')) return 'fromToCell';
  if (compact === 'fromcelltocell' || compact.includes('fromcellto')) return 'fromToCell';
  if (h.includes('from signal')) return 'fromSignal';
  if (h.includes('to signal')) return 'toSignal';
  if (h === 'metal type' || compact === 'metaltype') return 'metalType';
  if (h.includes('metal width')) return 'width';
  if (h.includes('metal length')) return 'length';
  if (h.includes('given current density')) return 'givenDensity';
  if (h.includes('implemented metal current')) return 'implementedCapacity';
  if (h.includes('minimum metal current')) return 'minCapacity';
  if (h.includes('routing metal imped')) return 'routingImpedance';
  if (h.includes('total imped')) return 'totalImpedance';

  return null;
}

function thinBlackBorder(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: COLORS.black } };
  return { top: side, bottom: side, left: side, right: side };
}

function parseNumeric(value: ExcelJS.CellValue, label: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value < 0) throw new Error(`${label} must be zero or positive`);
    return value;
  }
  const text = excelCellText(value);
  if (!text) throw new Error(`${label} is required`);
  const num = Number(text);
  if (!Number.isFinite(num)) throw new Error(`Invalid number "${text}" for ${label}`);
  if (num < 0) throw new Error(`${label} must be zero or positive`);
  return num;
}

export function formatFromToCell(fromCell: string, toCell: string): string {
  return `${fromCell.trim()} TO ${toCell.trim()}`;
}

export function parseFromToCell(text: string): { fromCell: string; toCell: string } {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('From Cell & To Cell value is required');

  const separators = [/\s+TO\s+/i, /\s+→\s+/, /\s+->\s+/, /\s+—\s+/];
  for (const separator of separators) {
    const parts = trimmed.split(separator);
    if (parts.length >= 2) {
      const fromCell = parts[0]?.trim() ?? '';
      const toCell = parts.slice(1).join(' ').trim();
      if (fromCell && toCell) return { fromCell, toCell };
    }
  }

  throw new Error(
    `Cannot parse route cells from "${trimmed}". Expected format like "DIG CELL TO ANALOG".`,
  );
}

function scoreWorksheetHeaders(sheet: ExcelJS.Worksheet): number {
  let bestScore = 0;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 20) return;
    const columnMap = new Map<number, RouteColumnKey>();
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = classifyColumn(excelCellText(cell.value));
      if (key && !columnMap.has(colNumber)) columnMap.set(colNumber, key);
    });
    const found = new Set(columnMap.values());
    const score = REQUIRED_IMPORT_COLUMNS.filter((k) => found.has(k)).length;
    if (score > bestScore) bestScore = score;
  });
  return bestScore;
}

function findBestWorksheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet {
  let bestSheet: ExcelJS.Worksheet | null = null;
  let bestScore = 0;

  for (const sheet of wb.worksheets) {
    const score = scoreWorksheetHeaders(sheet);
    if (score > bestScore) {
      bestScore = score;
      bestSheet = sheet;
    }
  }

  if (!bestSheet || bestScore < REQUIRED_IMPORT_COLUMNS.length) {
    throw new Error(
      'Invalid Metal Routing Excel file. No worksheet contains the required columns (From Cell & To Cell, signals, metal type, width, length).',
    );
  }

  return bestSheet;
}

function findHeaderRow(sheet: ExcelJS.Worksheet): { rowNumber: number; columnMap: Map<number, RouteColumnKey> } {
  let best = { rowNumber: 0, columnMap: new Map<number, RouteColumnKey>(), score: 0 };

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 20) return;
    const columnMap = new Map<number, RouteColumnKey>();
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = classifyColumn(excelCellText(cell.value));
      if (key && !columnMap.has(colNumber)) columnMap.set(colNumber, key);
    });
    const found = new Set(columnMap.values());
    const score = REQUIRED_IMPORT_COLUMNS.filter((k) => found.has(k)).length;
    if (score > best.score) best = { rowNumber, columnMap, score };
  });

  if (best.score < REQUIRED_IMPORT_COLUMNS.length) {
    const foundKeys = new Set(best.columnMap.values());
    const missing = REQUIRED_IMPORT_COLUMNS.filter((k) => !foundKeys.has(k)).map((k) => HEADERS[k]);
    throw new Error(
      `Invalid Metal Routing Excel template. Missing columns: ${missing.join(', ')}`,
    );
  }

  return { rowNumber: best.rowNumber, columnMap: best.columnMap };
}

function getCellByKey(
  row: ExcelJS.Row,
  columnMap: Map<number, RouteColumnKey>,
  key: RouteColumnKey,
): ExcelJS.CellValue {
  for (const [col, mapped] of columnMap.entries()) {
    if (mapped === key) return row.getCell(col).value;
  }
  return null;
}

function columnLettersToNumber(letters: string): number {
  let num = 0;
  for (let i = 0; i < letters.length; i++) {
    num = num * 26 + (letters.charCodeAt(i) - 64);
  }
  return num;
}

function numberToColumnLetters(num: number): string {
  let letters = '';
  let value = num;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}

function expandMergeRange(
  sheet: ExcelJS.Worksheet,
  range: string,
  map: Map<string, string>,
): void {
  const [start, end] = range.split(':');
  if (!start || !end) return;

  const startMatch = start.match(/^([A-Z]+)(\d+)$/i);
  const endMatch = end.match(/^([A-Z]+)(\d+)$/i);
  if (!startMatch || !endMatch) return;

  const startCol = columnLettersToNumber(startMatch[1].toUpperCase());
  const endCol = columnLettersToNumber(endMatch[1].toUpperCase());
  const startRow = Number(startMatch[2]);
  const endRow = Number(endMatch[2]);
  const masterValue = excelCellText(sheet.getCell(start).value);
  if (!masterValue) return;

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      map.set(normalizeCellAddress(`${numberToColumnLetters(col)}${row}`), masterValue);
    }
  }
}

function normalizeCellAddress(address: string): string {
  return address.replace(/\$/g, '').toUpperCase();
}

function mergeRangeFromObject(merge: Record<string, unknown>): string | null {
  const top = Number(merge.top ?? merge.s ?? merge.startRow);
  const left = Number(merge.left ?? merge.startCol);
  const bottom = Number(merge.bottom ?? merge.e ?? merge.endRow);
  const right = Number(merge.right ?? merge.endCol);
  if (![top, left, bottom, right].every((n) => Number.isFinite(n) && n > 0)) return null;
  return `${numberToColumnLetters(left)}${top}:${numberToColumnLetters(right)}${bottom}`;
}

function getWorksheetMergeRanges(sheet: ExcelJS.Worksheet): string[] {
  const ranges = new Set<string>();
  const model = (sheet as unknown as { model?: { merges?: unknown[] } }).model;

  for (const merge of model?.merges ?? []) {
    if (typeof merge === 'string') {
      ranges.add(merge);
      continue;
    }
    if (merge && typeof merge === 'object') {
      const asRange = mergeRangeFromObject(merge as Record<string, unknown>);
      if (asRange) ranges.add(asRange);
    }
  }

  const legacyMerges = (sheet as unknown as { _merges?: Record<string, unknown> })._merges ?? {};
  for (const key of Object.keys(legacyMerges)) {
    ranges.add(key);
    const value = legacyMerges[key];
    if (value && typeof value === 'object') {
      const asRange = mergeRangeFromObject(value as Record<string, unknown>);
      if (asRange) ranges.add(asRange);
    }
  }

  return [...ranges];
}

interface ParsedMergeRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  masterValue: string;
}

function buildParsedMergeRanges(sheet: ExcelJS.Worksheet): ParsedMergeRange[] {
  const parsed: ParsedMergeRange[] = [];

  for (const range of getWorksheetMergeRanges(sheet)) {
    const [start, end] = range.split(':');
    if (!start || !end) continue;

    const startMatch = start.match(/^([A-Z]+)(\d+)$/i);
    const endMatch = end.match(/^([A-Z]+)(\d+)$/i);
    if (!startMatch || !endMatch) continue;

    const startCol = columnLettersToNumber(startMatch[1].toUpperCase());
    const endCol = columnLettersToNumber(endMatch[1].toUpperCase());
    const startRow = Number(startMatch[2]);
    const endRow = Number(endMatch[2]);
    const masterValue = excelCellText(sheet.getCell(start).value);

    parsed.push({ startRow, endRow, startCol, endCol, masterValue });
  }

  return parsed;
}

function buildMergedValueMap(sheet: ExcelJS.Worksheet): Map<string, string> {
  const map = new Map<string, string>();
  for (const range of getWorksheetMergeRanges(sheet)) {
    expandMergeRange(sheet, range, map);
  }
  return map;
}

function getMergedMasterValue(
  rowNumber: number,
  colNumber: number,
  mergeRanges: ParsedMergeRange[],
): string {
  for (const range of mergeRanges) {
    if (
      rowNumber >= range.startRow
      && rowNumber <= range.endRow
      && colNumber >= range.startCol
      && colNumber <= range.endCol
    ) {
      return range.masterValue;
    }
  }
  return '';
}

function getLastPopulatedRow(sheet: ExcelJS.Worksheet): number {
  let lastRow = 1;
  sheet.eachRow({ includeEmpty: false }, (_row, rowNumber) => {
    lastRow = rowNumber;
  });
  return lastRow;
}

function getCellTextWithMerge(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  colNumber: number,
  mergedValues: Map<string, string>,
  mergeRanges: ParsedMergeRange[],
): string {
  const cell = sheet.getCell(rowNumber, colNumber);
  const direct = excelCellText(cell.value);
  if (direct) return direct;

  const fromMap = mergedValues.get(normalizeCellAddress(cell.address));
  if (fromMap) return fromMap;

  const fromRange = getMergedMasterValue(rowNumber, colNumber, mergeRanges);
  if (fromRange) return fromRange;

  return '';
}

function getCellNumericWithMerge(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  colNumber: number,
  mergedValues: Map<string, string>,
  mergeRanges: ParsedMergeRange[],
  label: string,
): number {
  const text = getCellTextWithMerge(sheet, rowNumber, colNumber, mergedValues, mergeRanges);
  if (!text) return parseNumeric(sheet.getCell(rowNumber, colNumber).value, label);
  return parseNumeric(text, label);
}

function isBlankRow(
  sheet: ExcelJS.Worksheet,
  rowNum: number,
  cols: number[],
  mergedValues: Map<string, string>,
  mergeRanges: ParsedMergeRange[],
): boolean {
  return cols.every((col) => !getCellTextWithMerge(sheet, rowNum, col, mergedValues, mergeRanges));
}

function colNumberForKey(columnMap: Map<number, RouteColumnKey>, key: RouteColumnKey): number | null {
  for (const [col, mapped] of columnMap.entries()) {
    if (mapped === key) return col;
  }
  return null;
}

export async function parseMetalRoutingExcelBuffer(
  buffer: Buffer,
  options?: { log?: boolean },
): Promise<ParsedRouteBlock[]> {
  const diagnostics = await parseMetalRoutingExcelWithDiagnostics(buffer, options);
  return diagnostics.routeBlocks;
}

export async function parseMetalRoutingExcelWithDiagnostics(
  buffer: Buffer,
  options?: { log?: boolean },
): Promise<ParseMetalRoutingDiagnostics> {
  const shouldLog = options?.log ?? false;
  const log = (...args: unknown[]) => {
    if (shouldLog) console.log(LOG_PREFIX, ...args);
  };

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  if (!wb.worksheets.length) throw new Error('Excel file contains no worksheets');

  const sheet = findBestWorksheet(wb);
  const { rowNumber: headerRow, columnMap } = findHeaderRow(sheet);
  const mergedValues = buildMergedValueMap(sheet);
  const mergeRanges = buildParsedMergeRanges(sheet);

  log('worksheet', sheet.name, 'headerRow', headerRow, 'mergeRanges', mergeRanges.length);

  const fromToCol = colNumberForKey(columnMap, 'fromToCell');
  const fromSignalCol = colNumberForKey(columnMap, 'fromSignal');
  const toSignalCol = colNumberForKey(columnMap, 'toSignal');
  const metalTypeCol = colNumberForKey(columnMap, 'metalType');
  const widthCol = colNumberForKey(columnMap, 'width');
  const lengthCol = colNumberForKey(columnMap, 'length');

  if (!fromToCol || !fromSignalCol || !toSignalCol || !metalTypeCol || !widthCol || !lengthCol) {
    throw new Error('Required Metal Routing columns were not found');
  }

  const blocks: ParsedRouteBlock[] = [];
  let current: ParsedRouteBlock | null = null;
  let carryFromTo = '';
  let carryFromSignal = '';
  let carryToSignal = '';
  const trackedCols = [fromToCol, fromSignalCol, toSignalCol, metalTypeCol, widthCol, lengthCol];
  const lastRow = getLastPopulatedRow(sheet);

  for (let rowNum = headerRow + 1; rowNum <= lastRow; rowNum++) {
    if (isBlankRow(sheet, rowNum, trackedCols, mergedValues, mergeRanges)) {
      if (current?.metals.length) {
        blocks.push(current);
        current = null;
      }
      carryFromTo = '';
      carryFromSignal = '';
      carryToSignal = '';
      continue;
    }

    const rawFromTo = getCellTextWithMerge(sheet, rowNum, fromToCol, mergedValues, mergeRanges);
    const rawFromSignal = getCellTextWithMerge(sheet, rowNum, fromSignalCol, mergedValues, mergeRanges);
    const rawToSignal = getCellTextWithMerge(sheet, rowNum, toSignalCol, mergedValues, mergeRanges);
    const metalType = getCellTextWithMerge(sheet, rowNum, metalTypeCol, mergedValues, mergeRanges);

    if (rawFromTo) carryFromTo = rawFromTo;
    if (rawFromSignal) carryFromSignal = rawFromSignal;
    if (rawToSignal) carryToSignal = rawToSignal;

    if (!metalType) continue;

    if (!carryFromTo || !carryFromSignal || !carryToSignal) {
      throw new Error(
        `Row ${rowNum}: route information is incomplete. Each metal row needs From/To Cell, From Signal, and To Signal (merged cells are supported).`,
      );
    }

    let fromCell: string;
    let toCell: string;
    try {
      ({ fromCell, toCell } = parseFromToCell(carryFromTo));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid route cell format';
      throw new Error(`Row ${rowNum}: ${message}`);
    }

    const routeKey = `${fromCell}|${toCell}|${carryFromSignal}|${carryToSignal}`;

    if (!current || `${current.fromCell}|${current.toCell}|${current.fromSignal}|${current.toSignal}` !== routeKey) {
      if (current) blocks.push(current);
      current = {
        fromCell,
        toCell,
        fromSignal: carryFromSignal,
        toSignal: carryToSignal,
        metals: [],
      };
    }

    const width = getCellNumericWithMerge(
      sheet,
      rowNum,
      widthCol,
      mergedValues,
      mergeRanges,
      `Metal Width on row ${rowNum}`,
    );
    const length = getCellNumericWithMerge(
      sheet,
      rowNum,
      lengthCol,
      mergedValues,
      mergeRanges,
      `Metal Length on row ${rowNum}`,
    );

    current.metals.push({ metalType: metalType.trim(), width, length });
  }

  if (current) blocks.push(current);

  if (blocks.length === 0) {
    throw new Error('No route metal rows found in the Excel file');
  }

  for (const block of blocks) {
    if (block.metals.length === 0) {
      throw new Error(
        `Route ${formatFromToCell(block.fromCell, block.toCell)} has no metal rows`,
      );
    }
  }

  const totalMetalRows = blocks.reduce((sum, block) => sum + block.metals.length, 0);
  log('parsed route blocks', blocks.length, 'metal rows', totalMetalRows);
  blocks.forEach((block, index) => {
    log(`  block ${index + 1}`, {
      fromCell: block.fromCell,
      toCell: block.toCell,
      fromSignal: block.fromSignal,
      toSignal: block.toSignal,
      metals: block.metals.length,
    });
  });

  return {
    worksheetName: sheet.name,
    headerRow,
    mergeRangeCount: mergeRanges.length,
    dataRowsScanned: Math.max(0, lastRow - headerRow),
    routeBlocks: blocks,
    totalMetalRows,
  };
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function styleHeaderCell(cell: ExcelJS.Cell, value: string) {
  cell.value = value;
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.black } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerYellow } };
  cell.border = thinBlackBorder();
}

function styleDataCell(cell: ExcelJS.Cell, value: ExcelJS.CellValue, strong = false) {
  cell.value = value;
  cell.font = { name: 'Calibri', size: 11, color: { argb: COLORS.black } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: strong ? COLORS.dataLimeStrong : COLORS.dataLime },
  };
  cell.border = thinBlackBorder();
}

function colIndex(key: RouteColumnKey): number {
  return COL_ORDER.indexOf(key) + 1;
}

const DEFAULT_TEMPLATE_METAL_TYPES = ['MET2', 'MET3', 'MET4', 'MET5'];
const SAMPLE_WIDTHS = [1, 1, 1.2, 0.8, 1, 1.1];
const SAMPLE_LENGTHS = [10, 10, 8, 12, 9, 11];

function buildTemplateSampleRoute(metalTypes: string[]): RouteExcelRecord {
  const types = metalTypes.length > 0 ? metalTypes : DEFAULT_TEMPLATE_METAL_TYPES;
  return {
    fromCell: 'DIG CELL',
    toCell: 'ANALOG',
    fromSignal: 'FROM_SIG',
    toSignal: 'TO_SIG',
    minimumMetalCurrentCapacity: 0,
    totalImpedance: 0,
    metals: types.map((metalType, index) => ({
      metalType,
      width: SAMPLE_WIDTHS[index % SAMPLE_WIDTHS.length],
      length: SAMPLE_LENGTHS[index % SAMPLE_LENGTHS.length],
      givenCurrentDensity: 0,
      implementedCurrentMetalCapacity: 0,
      routingMetalImpedance: 0,
    })),
  };
}

export async function buildMetalRoutingTemplateExcelBuffer(
  metalTypes?: string[],
): Promise<Buffer> {
  return buildMetalRoutingExcelBuffer([buildTemplateSampleRoute(metalTypes ?? [])], { template: true });
}

export async function buildMetalRoutingExcelBuffer(
  routes: RouteExcelRecord[],
  options?: { template?: boolean },
): Promise<Buffer> {
  const isTemplate = options?.template ?? false;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Epical Dashboard';
  wb.created = new Date();

  const sheet = wb.addWorksheet('Metal Routing');
  sheet.columns = [
    { width: 24 },
    { width: 18 },
    { width: 18 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 22 },
    { width: 22 },
    { width: 18 },
    { width: 16 },
  ];

  const headerRow = sheet.getRow(1);
  COL_ORDER.forEach((key, index) => {
    styleHeaderCell(headerRow.getCell(index + 1), HEADERS[key]);
  });
  headerRow.height = 28;

  let currentRow = 2;

  for (const route of routes) {
    const metals = route.metals.length > 0 ? route.metals : [{
      metalType: '',
      width: '',
      length: '',
      givenCurrentDensity: '',
      implementedCurrentMetalCapacity: '',
      routingMetalImpedance: '',
    }];
    const startRow = currentRow;
    const endRow = currentRow + metals.length - 1;
    const fromToLabel = formatFromToCell(route.fromCell, route.toCell);

    metals.forEach((metal, index) => {
      const row = sheet.getRow(currentRow);
      const isFirst = index === 0;

      if (isFirst) {
        styleDataCell(row.getCell(colIndex('fromToCell')), fromToLabel);
        styleDataCell(row.getCell(colIndex('fromSignal')), route.fromSignal);
        styleDataCell(row.getCell(colIndex('toSignal')), route.toSignal);
      } else {
        styleDataCell(row.getCell(colIndex('fromToCell')), '');
        styleDataCell(row.getCell(colIndex('fromSignal')), '');
        styleDataCell(row.getCell(colIndex('toSignal')), '');
      }

      styleDataCell(row.getCell(colIndex('metalType')), metal.metalType);
      styleDataCell(row.getCell(colIndex('width')), metal.width);
      styleDataCell(row.getCell(colIndex('length')), metal.length);

      if (isTemplate) {
        styleDataCell(row.getCell(colIndex('givenDensity')), '');
        styleDataCell(row.getCell(colIndex('implementedCapacity')), '');
        styleDataCell(row.getCell(colIndex('minCapacity')), isFirst ? '' : '');
        styleDataCell(row.getCell(colIndex('routingImpedance')), '');
        styleDataCell(row.getCell(colIndex('totalImpedance')), isFirst ? '' : '');
      } else {
        styleDataCell(row.getCell(colIndex('givenDensity')), round4(Number(metal.givenCurrentDensity) || 0));
        styleDataCell(row.getCell(colIndex('implementedCapacity')), round4(Number(metal.implementedCurrentMetalCapacity) || 0));

        if (isFirst) {
          styleDataCell(row.getCell(colIndex('minCapacity')), round4(route.minimumMetalCurrentCapacity), true);
        } else {
          styleDataCell(row.getCell(colIndex('minCapacity')), '');
        }

        styleDataCell(row.getCell(colIndex('routingImpedance')), round4(Number(metal.routingMetalImpedance) || 0));

        if (isFirst) {
          styleDataCell(row.getCell(colIndex('totalImpedance')), round4(route.totalImpedance), true);
        } else {
          styleDataCell(row.getCell(colIndex('totalImpedance')), '');
        }
      }

      row.height = 20;
      currentRow++;
    });

    if (metals.length > 1) {
      sheet.mergeCells(startRow, colIndex('fromToCell'), endRow, colIndex('fromToCell'));
      sheet.mergeCells(startRow, colIndex('fromSignal'), endRow, colIndex('fromSignal'));
      sheet.mergeCells(startRow, colIndex('toSignal'), endRow, colIndex('toSignal'));
      sheet.mergeCells(startRow, colIndex('minCapacity'), endRow, colIndex('minCapacity'));
      sheet.mergeCells(startRow, colIndex('totalImpedance'), endRow, colIndex('totalImpedance'));

      [colIndex('fromToCell'), colIndex('fromSignal'), colIndex('toSignal'), colIndex('minCapacity'), colIndex('totalImpedance')].forEach((col) => {
        const cell = sheet.getCell(startRow, col);
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });
    }
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}
