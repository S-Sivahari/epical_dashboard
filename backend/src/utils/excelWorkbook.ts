import ExcelJS from 'exceljs';

export async function loadExcelWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  return wb;
}

export function getWorksheetNames(wb: ExcelJS.Workbook): string[] {
  return wb.worksheets.map((w) => w.name);
}

export function getWorksheet(wb: ExcelJS.Workbook, sheetName: string): ExcelJS.Worksheet | undefined {
  return wb.getWorksheet(sheetName) ?? wb.worksheets.find((w) => w.name === sheetName);
}

export function findWorksheetName(wb: ExcelJS.Workbook, candidates: string[]): string | undefined {
  const names = getWorksheetNames(wb);
  for (const c of candidates) {
    const exact = names.find((n) => n.trim().toLowerCase() === c.trim().toLowerCase());
    if (exact) return exact;
  }
  const lower = candidates.map((c) => c.trim().toLowerCase());
  for (const name of names) {
    const n = name.toLowerCase();
    if (lower.some((c) => n === c || n.includes(c))) {
      return name;
    }
  }
  return undefined;
}

/** Excel 1900 date serial → UTC Date (replaces SheetJS SSF.parse_date_code). */
export function parseExcelSerialDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const ms = (serial - 25569) * 86400 * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}
