import ExcelJS from 'exceljs'
import * as XLSX from 'xlsx'
import type { Company } from './payslipGenerator'
import { cellToString } from './salaryStructureParser'

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Map common company-sheet labels → canonical field names. */
const COMPANY_LABEL_ALIASES: Record<string, string> = {
  'pay month': 'Pay Month',
  'payroll month': 'Pay Month',
  'pay period': 'Pay Month',
  'salary month': 'Pay Month',
  'month': 'Pay Month',
  'pay date': 'Pay Date',
  'payment date': 'Pay Date',
  'date of payment': 'Pay Date',
  'payout date': 'Pay Date',
  'working days': 'Working Days',
  'work days': 'Working Days',
  'company name': 'Company Name',
  'company pan': 'Company PAN',
  'default tax regime': 'Default Tax Regime',
  'tax regime': 'Default Tax Regime',
}

const SKIP_LABELS = new Set([
  'company details',
  'field',
  'value',
  'label',
  '',
])

function normalizeCompanyLabel(label: string): string {
  const key = label.trim().toLowerCase().replace(/\s+/g, ' ')
  if (SKIP_LABELS.has(key)) return ''
  return COMPANY_LABEL_ALIASES[key] ?? label.trim()
}

function isPayMonthLabel(label: string): boolean {
  const l = label.toLowerCase()
  return l === 'pay month' || l.includes('pay month') || l === 'pay period' || l === 'payroll month'
}

function isPayDateLabel(label: string): boolean {
  const l = label.toLowerCase()
  return l.includes('pay date') || l === 'payment date' || l === 'payout date'
}

function formatFromDate(d: Date, label: string): string {
  const day = String(d.getUTCDate()).padStart(2, '0')
  const monShort = MONTHS_SHORT[d.getUTCMonth()]
  const monLong = MONTHS_LONG[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  if (isPayMonthLabel(label) && !isPayDateLabel(label)) {
    return `${monLong} ${year}`
  }
  if (isPayDateLabel(label)) {
    return `${day}-${monShort}-${year}`
  }
  return `${day}-${monShort}-${year}`
}

/** Convert Excel / JS date values to display strings for payslip fields. */
export function formatCompanyFieldValue(val: unknown, canonicalLabel: string): string | number {
  if (val === null || val === undefined) return ''
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return formatFromDate(val, canonicalLabel)
  }
  if (typeof val === 'number' && (isPayDateLabel(canonicalLabel) || isPayMonthLabel(canonicalLabel))) {
    const dc = XLSX.SSF.parse_date_code(val)
    if (dc) {
      const d = new Date(Date.UTC(dc.y, dc.m - 1, dc.d))
      return formatFromDate(d, canonicalLabel)
    }
  }
  const text = cellToString(val)
  if (!text) return ''
  if (typeof val === 'number' && !isPayDateLabel(canonicalLabel) && !isPayMonthLabel(canonicalLabel)) {
    return val
  }
  return text
}

function setCompanyField(company: Company, rawLabel: string, rawValue: unknown): void {
  const label = normalizeCompanyLabel(rawLabel)
  if (!label) return
  const formatted = formatCompanyFieldValue(rawValue, label)
  if (formatted === '' || formatted === null || formatted === undefined) return
  company[label] = formatted
}

/** Parse company sheet (label col A, value col B) using formatted cell text. */
export function parseCompanySheetXlsx(ws: XLSX.WorkSheet): Company {
  const company: Company = {}
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][]

  for (const row of rows) {
    if (!row || row[0] === undefined || row[0] === null || row[0] === '') continue
    const rawLabel = cellToString(row[0])
    if (!rawLabel || SKIP_LABELS.has(rawLabel.toLowerCase())) continue
    const rawVal = row[1]
    if (rawVal === undefined || rawVal === null || rawVal === '') continue
    setCompanyField(company, rawLabel, rawVal)
  }

  return finalizeCompany(company)
}

/** ExcelJS read — preserves dates and formatted text from the company sheet. */
export async function parseCompanySheetExcelJS(buffer: Buffer): Promise<Company> {
  const company: Company = {}
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  let sheet =
    wb.getWorksheet('company') ??
    wb.worksheets.find((w) => w.name.trim().toLowerCase() === 'company') ??
    wb.worksheets.find((w) => w.name.toLowerCase().includes('company'))

  if (!sheet) return company

  sheet.eachRow((row) => {
    const rawLabel = cellToString(row.getCell(1).value)
    if (!rawLabel) return
    const rawVal = row.getCell(2).value
    if (rawVal === null || rawVal === undefined || rawVal === '') return
    setCompanyField(company, rawLabel, rawVal)
  })

  return finalizeCompany(company)
}

/** Prefer ExcelJS values for pay period fields; merge the rest from XLSX. */
export function mergeCompanyRecords(xlsxCompany: Company, excelJsCompany: Company): Company {
  const merged: Company = { ...xlsxCompany, ...excelJsCompany }
  for (const key of ['Pay Month', 'Pay Date', 'Working Days', 'Default Tax Regime'] as const) {
    const fromJs = excelJsCompany[key]
    if (fromJs !== undefined && fromJs !== null && String(fromJs).trim() !== '') {
      merged[key] = fromJs
    }
  }
  return finalizeCompany(merged)
}

export function finalizeCompany(company: Company): Company {
  const out = { ...company }

  if (out['Pay Month'] !== undefined && out['Pay Month'] !== null && out['Pay Month'] !== '') {
    out['Pay Month'] = String(formatCompanyFieldValue(out['Pay Month'], 'Pay Month'))
  }
  if (out['Pay Date'] !== undefined && out['Pay Date'] !== null && out['Pay Date'] !== '') {
    out['Pay Date'] = String(formatCompanyFieldValue(out['Pay Date'], 'Pay Date'))
  }

  return out
}

export async function readCompanyFromWorkbookBuffer(buffer: Buffer, wb: XLSX.WorkBook): Promise<Company> {
  const sheetName =
    wb.SheetNames.find((n) => n.trim().toLowerCase() === 'company') ??
    wb.SheetNames.find((n) => n.toLowerCase().includes('company'))

  let xlsxCompany: Company = {}
  if (sheetName && wb.Sheets[sheetName]) {
    xlsxCompany = parseCompanySheetXlsx(wb.Sheets[sheetName])
  }

  let excelJsCompany: Company = {}
  try {
    excelJsCompany = await parseCompanySheetExcelJS(buffer)
  } catch {
    /* optional */
  }

  return mergeCompanyRecords(xlsxCompany, excelJsCompany)
}
