import ExcelJS from 'exceljs'
import type { Company } from './payslipGenerator'
import { cellToString } from './salaryStructureParser'
import { parseExcelSerialDate } from '../utils/excelWorkbook'

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

export function formatCompanyFieldValue(val: unknown, canonicalLabel: string): string | number {
  if (val === null || val === undefined) return ''
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return formatFromDate(val, canonicalLabel)
  }
  if (typeof val === 'number' && (isPayDateLabel(canonicalLabel) || isPayMonthLabel(canonicalLabel))) {
    const d = parseExcelSerialDate(val)
    if (d) {
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

export async function parseCompanySheetExcelJS(buffer: Buffer): Promise<Company> {
  const company: Company = {}
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as any)

  const sheet =
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

export async function readCompanyFromWorkbookBuffer(buffer: Buffer): Promise<Company> {
  return parseCompanySheetExcelJS(buffer)
}
