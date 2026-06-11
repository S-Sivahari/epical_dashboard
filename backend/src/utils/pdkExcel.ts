import ExcelJS from 'exceljs';

export interface ParsedPdkMetalRow {
  metalType: string;
  currentDensity: number;
  currentDensityAt110: number;
  sheetResistance: number;
}

export interface ParsedPdkExcel {
  metals: ParsedPdkMetalRow[];
  metadata: {
    pdkName?: string;
    technologyNode?: string;
    notes?: string;
  };
}

type PdkColumnKey = 'name' | 'jdc' | 'jdc110' | 'sheetR';

const REQUIRED_COLUMNS: PdkColumnKey[] = ['name', 'jdc', 'jdc110', 'sheetR'];

const COLUMN_LABELS: Record<PdkColumnKey, string> = {
  name: 'Name',
  jdc: 'J_DC(mA/µm)',
  jdc110: 'J_DC(mA/µm) at 110° C',
  sheetR: 'mOhm/Sq at 110° C',
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
  return text
    .toLowerCase()
    .replace(/µ/g, 'u')
    .replace(/μm/g, 'um')
    .replace(/°\s*c/g, ' c')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyColumn(header: string): PdkColumnKey | null {
  const h = normalizeHeader(header);
  const compact = h.replace(/\s+/g, '');

  if (h === 'name' || compact === 'metaltype' || h === 'metal type' || h === 'metal') {
    return 'name';
  }

  const has110 = h.includes('110') || compact.includes('at110');

  if (has110) {
    if (
      compact.includes('mohm') ||
      compact.includes('sheet') ||
      compact.includes('sq') ||
      h.includes('mohm/sq') ||
      h.includes('sheet resistance')
    ) {
      return 'sheetR';
    }
    if (compact.includes('j_dc') || compact.includes('jdc') || h.includes('current density')) {
      return 'jdc110';
    }
  }

  if (
    compact.includes('mohm') ||
    compact.includes('sheetresistance') ||
    h.includes('mohm/sq') ||
    h.includes('sheet resistance')
  ) {
    return 'sheetR';
  }

  if (compact.includes('j_dc') || compact.includes('jdc') || h.includes('current density')) {
    return 'jdc';
  }

  return null;
}

function parseNumeric(value: ExcelJS.CellValue, rowLabel: string, columnLabel: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value < 0) {
      throw new Error(`"${columnLabel}" must be zero or positive on row "${rowLabel}"`);
    }
    return value;
  }

  const text = excelCellText(value);
  if (!text) {
    throw new Error(
      `Missing value for "${columnLabel}" on row "${rowLabel}". ` +
        'Fill in the green cells for J_DC @110°C and Sheet Resistance before importing.',
    );
  }
  const num = Number(text);
  if (!Number.isFinite(num)) {
    throw new Error(`Invalid number "${text}" for "${columnLabel}" on row "${rowLabel}"`);
  }
  if (num < 0) {
    throw new Error(`"${columnLabel}" must be zero or positive on row "${rowLabel}"`);
  }
  return num;
}

function extractMetadata(sheet: ExcelJS.Worksheet, beforeRow: number): ParsedPdkExcel['metadata'] {
  const metadata: ParsedPdkExcel['metadata'] = {};

  for (let rowNum = 1; rowNum < beforeRow; rowNum++) {
    const row = sheet.getRow(rowNum);
    const cells: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      cells.push(excelCellText(cell.value));
    });
    if (cells.length === 0) continue;

    const joined = cells.join(' ').trim();
    const lower = joined.toLowerCase();

    if (lower.startsWith('pdk name') || lower.startsWith('module name')) {
      metadata.pdkName = cells[cells.length - 1] || joined.split(':').slice(1).join(':').trim();
    } else if (lower.startsWith('technology node') || lower.startsWith('tech node')) {
      metadata.technologyNode = cells[cells.length - 1] || joined.split(':').slice(1).join(':').trim();
    } else if (lower.startsWith('notes')) {
      metadata.notes = cells[cells.length - 1] || joined.split(':').slice(1).join(':').trim();
    }
  }

  return metadata;
}

function findHeaderRow(sheet: ExcelJS.Worksheet): { rowNumber: number; columnMap: Map<number, PdkColumnKey> } {
  let bestMatch = { rowNumber: 0, columnMap: new Map<number, PdkColumnKey>(), score: 0 };

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 15) return;

    const columnMap = new Map<number, PdkColumnKey>();
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = classifyColumn(excelCellText(cell.value));
      if (key && !columnMap.has(colNumber)) {
        columnMap.set(colNumber, key);
      }
    });

    const found = new Set(columnMap.values());
    const score = REQUIRED_COLUMNS.filter((k) => found.has(k)).length;
    if (score > bestMatch.score) {
      bestMatch = { rowNumber, columnMap, score };
    }
  });

  if (bestMatch.score < REQUIRED_COLUMNS.length) {
    const foundKeys = new Set(bestMatch.columnMap.values());
    const missingLabels = REQUIRED_COLUMNS.filter((k) => !foundKeys.has(k)).map((k) => COLUMN_LABELS[k]);

    throw new Error(
      `Invalid PDK template. Missing required columns: ${missingLabels.join(', ')}. ` +
        `Expected: Name, J_DC(mA/µm), J_DC(mA/µm) at 110° C, mOhm/Sq at 110° C`,
    );
  }

  return { rowNumber: bestMatch.rowNumber, columnMap: bestMatch.columnMap };
}

function getCellByKey(row: ExcelJS.Row, columnMap: Map<number, PdkColumnKey>, key: PdkColumnKey): ExcelJS.CellValue {
  for (const [col, k] of columnMap.entries()) {
    if (k === key) return row.getCell(col).value;
  }
  return null;
}

export async function parsePdkExcelBuffer(buffer: Buffer): Promise<ParsedPdkExcel> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const sheet = wb.worksheets[0];
  if (!sheet) {
    throw new Error('Excel file contains no worksheets');
  }

  const { rowNumber: headerRow, columnMap } = findHeaderRow(sheet);
  const metadata = extractMetadata(sheet, headerRow);
  const metals: ParsedPdkMetalRow[] = [];

  for (let rowNum = headerRow + 1; rowNum <= sheet.rowCount; rowNum++) {
    const row = sheet.getRow(rowNum);
    const name = excelCellText(getCellByKey(row, columnMap, 'name'));
    if (!name) continue;

    const metalType = name.trim();
    metals.push({
      metalType,
      currentDensity: parseNumeric(getCellByKey(row, columnMap, 'jdc'), metalType, COLUMN_LABELS.jdc),
      currentDensityAt110: parseNumeric(
        getCellByKey(row, columnMap, 'jdc110'),
        metalType,
        COLUMN_LABELS.jdc110,
      ),
      sheetResistance: parseNumeric(
        getCellByKey(row, columnMap, 'sheetR'),
        metalType,
        COLUMN_LABELS.sheetR,
      ),
    });
  }

  if (metals.length === 0) {
    throw new Error('No metal layer rows found. Add at least one row with a Name value.');
  }

  const names = metals.map((m) => m.metalType.toLowerCase());
  if (new Set(names).size !== names.length) {
    throw new Error('Duplicate metal layer names found in the spreadsheet');
  }

  return { metals, metadata };
}

const TEMPLATE_METALS = [
  { name: 'MET1', jdc: 1 },
  { name: 'MET2', jdc: 1 },
  { name: 'MET3', jdc: 1 },
  { name: 'MET4', jdc: 1 },
  { name: 'MET5', jdc: 1 },
  { name: 'MET6', jdc: 1.6 },
  { name: 'AP', jdc: 6 },
];

const PDK_TEMPLATE_COLS = 4;
const PDK_TEMPLATE_LAST_ROW = 2 + TEMPLATE_METALS.length;

const PDK_COLORS = {
  white: 'FFFFFFFF',
  black: 'FF000000',
  inputGreen: 'FF63BE7B',
};

function thinBlackBorder(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: PDK_COLORS.black } };
  return { top: side, bottom: side, left: side, right: side };
}

function styleTemplateCell(
  cell: ExcelJS.Cell,
  options: {
    value?: ExcelJS.CellValue;
    bold?: boolean;
    fill?: string;
    horizontal?: 'left' | 'center' | 'right';
  } = {},
) {
  if (options.value !== undefined) {
    cell.value = options.value;
  }
  cell.font = {
    name: 'Calibri',
    size: 11,
    bold: options.bold ?? false,
    color: { argb: PDK_COLORS.black },
  };
  cell.alignment = {
    horizontal: options.horizontal ?? 'center',
    vertical: 'middle',
    wrapText: true,
  };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: options.fill ?? PDK_COLORS.white },
  };
  cell.border = thinBlackBorder();
}

function styleTemplateGrid(sheet: ExcelJS.Worksheet) {
  sheet.columns = [
    { width: 11 },
    { width: 14 },
    { width: 24 },
    { width: 22 },
  ];

  sheet.getRow(1).height = 18;
  sheet.getRow(2).height = 30;

  for (let rowNum = 3; rowNum <= PDK_TEMPLATE_LAST_ROW; rowNum++) {
    sheet.getRow(rowNum).height = 18;
  }

  // Row 1 — grouped headers
  styleTemplateCell(sheet.getCell('A1'));
  sheet.mergeCells('B1:C1');
  styleTemplateCell(sheet.getCell('B1'), { value: 'Current Density', bold: true });
  styleTemplateCell(sheet.getCell('D1'), { value: 'Sheet Resistance', bold: true });

  // Row 2 — field headers
  styleTemplateCell(sheet.getCell('A2'), { value: 'Name', bold: true });
  styleTemplateCell(sheet.getCell('B2'), { value: 'J_DC(mA/µm)', bold: true });
  styleTemplateCell(sheet.getCell('C2'), { value: 'J_DC(mA/µm) at 110° C', bold: true });
  styleTemplateCell(sheet.getCell('D2'), { value: 'mOhm/Sq at 110° C', bold: true });

  // Rows 3–9 — default metal layers
  TEMPLATE_METALS.forEach((metal, index) => {
    const rowNum = index + 3;
    styleTemplateCell(sheet.getCell(rowNum, 1), { value: metal.name });
    styleTemplateCell(sheet.getCell(rowNum, 2), { value: metal.jdc });
    styleTemplateCell(sheet.getCell(rowNum, 3), { value: null, fill: PDK_COLORS.inputGreen });
    styleTemplateCell(sheet.getCell(rowNum, 4), { value: null, fill: PDK_COLORS.inputGreen });
  });

  // Ensure every cell in the engineering grid has consistent borders and background.
  for (let rowNum = 1; rowNum <= PDK_TEMPLATE_LAST_ROW; rowNum++) {
    for (let colNum = 1; colNum <= PDK_TEMPLATE_COLS; colNum++) {
      const cell = sheet.getCell(rowNum, colNum);
      if (!cell.border) {
        cell.border = thinBlackBorder();
      }
      if (!cell.fill) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: PDK_COLORS.white },
        };
      }
    }
  }
}

export async function buildPdkTemplateExcelBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Epical Dashboard';
  wb.created = new Date();

  const sheet = wb.addWorksheet('PDK', {
    views: [{ state: 'frozen', ySplit: 2, activeCell: 'C3' }],
  });

  styleTemplateGrid(sheet);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
