import type ExcelJS from 'exceljs'
import {
  parseSalaryStructureWithExcelJS,
  parseStructureMatrix,
  parseStructureFallbackScan,
  resolveSalaryStructureSheetName,
  combineSalaryStructureSources,
  cellToString,
  sheetToMatrix,
} from './salaryStructureParser'
import { readCompanyFromWorkbookBuffer } from './companyParser'
import {
  findWorksheetName,
  getWorksheet,
  getWorksheetNames,
  loadExcelWorkbook,
} from '../utils/excelWorkbook'
import { formatPayslipPersonName } from '../utils/personName'
import {
  Document,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalAlign,
  BorderStyle,
  UnderlineType,
  AlignmentType,
  convertInchesToTwip,
  HeightRule,
} from 'docx'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { formatPayslipTitleLabel } from './payslipDownloadName'

// ============================================================================
// THEME COLORS (same as Python version)
// ============================================================================
const COLORS = {
  PRIMARY: '2F6B4F',
  PRIMARY_DK: '0A4136',
  PRIMARY_LT: 'C9E4DC',
  HEADER_TXT: 'FFFFFF',
  BORDER: 'B7C9BC',
  ROW_ALT: 'F4F9F6',
  LABEL_BG: 'EAF3EE',
  TEXT: '1F2937',
  MUTED: '6B7280',
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function numToIndianWords(n: number): string {
  n = Math.round(n)
  if (n === 0) return 'Zero'

  const units = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ]
  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ]

  function two(num: number): string {
    if (num < 20) return units[num]
    return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + units[num % 10] : '')
  }

  function three(num: number): string {
    if (num >= 100) {
      return units[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + two(num % 100) : '')
    }
    return two(num)
  }

  const crore = Math.floor(n / 10000000)
  n %= 10000000
  const lakh = Math.floor(n / 100000)
  n %= 100000
  const thousand = Math.floor(n / 1000)
  n %= 1000
  const rest = n

  const out: string[] = []
  if (crore) out.push(three(crore) + ' Crore')
  if (lakh) out.push(three(lakh) + ' Lakh')
  if (thousand) out.push(three(thousand) + ' Thousand')
  if (rest) out.push(three(rest))

  return out.join(' ').trim()
}

function formatAmount(v: any): string {
  try {
    const num = parseFloat(v)
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)
  } catch {
    return ''
  }
}

function safe(v: any, defaultVal = ''): string {
  return v === null || v === undefined ? defaultVal : String(v)
}

// ============================================================================
// READ EXCEL MASTER FILE
// ============================================================================
export interface Company {
  [key: string]: any
}

export interface SalaryComponentMeta {
  section: 'Earnings' | 'Deductions'
  default: number
  order: number
}

export interface SalaryStructure {
  [key: string]: SalaryComponentMeta
}

export interface Employee {
  [key: string]: any
}


function normalizeEmpIdKey(row: Record<string, unknown>): string | null {
  for (const key of Object.keys(row)) {
    const k = key.trim().toLowerCase()
    if (k === 'emp id' || k === 'employee id' || k === 'empid' || k === 'employeeid') {
      return key
    }
  }
  return null
}

const SKIP_SHEETS = new Set(['readme', 'read me', 'how to use', 'instructions'])

function isSkipSheet(name: string): boolean {
  return SKIP_SHEETS.has(name.trim().toLowerCase())
}

function parseSalaryStructureFromSheet(sheet: ExcelJS.Worksheet): SalaryStructure {
  return parseStructureMatrix(sheetToMatrix(sheet))
}

function parseEmployeeSheetFromMatrix(rows: unknown[][]): Employee[] {
  let headerIdx = rows.findIndex(
    (row) => String(row?.[0] ?? '').trim().toLowerCase() === 'emp id',
  )
  if (headerIdx < 0) headerIdx = 3

  const headerRow = rows[headerIdx]
  if (!headerRow) return []

  const headers = headerRow.map((h) => String(h ?? '').trim())
  const employees: Employee[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every((c) => c === '' || c === null || c === undefined)) continue

    const emp: Employee = {}
    headers.forEach((h, j) => {
      if (!h) return
      const val = row[j]
      if (val !== '' && val !== null && val !== undefined) emp[h] = val
    })

    const idKey = normalizeEmpIdKey(emp)
    if (!idKey || !emp[idKey]) continue
    emp['Emp ID'] = emp[idKey]
    employees.push(emp)
  }

  return employees
}

function parseEmployeeSheet(sheet: ExcelJS.Worksheet): Employee[] {
  return parseEmployeeSheetFromMatrix(sheetToMatrix(sheet))
}

function parseStructureFromWorkbook(wb: ExcelJS.Workbook): {
  structure: SalaryStructure
  salarySheetName?: string
} {
  const sheetNames = getWorksheetNames(wb)
  let salarySheetName = resolveSalaryStructureSheetName(sheetNames)
  if (!salarySheetName) {
    salarySheetName = findWorksheetName(wb, [
      'salary_structure',
      'salary structure',
      'Salary Structure',
      'SalaryStructure',
      'Structure',
    ])
  }

  let structure: SalaryStructure = {}
  if (salarySheetName) {
    const sheet = getWorksheet(wb, salarySheetName)
    if (sheet) {
      structure = parseSalaryStructureFromSheet(sheet)
    }
  }

  if (Object.keys(structure).length === 0) {
    for (const name of sheetNames) {
      if (isSkipSheet(name)) continue
      const sheet = getWorksheet(wb, name)
      if (!sheet) continue
      const trial = parseSalaryStructureFromSheet(sheet)
      if (Object.keys(trial).length > 0) {
        structure = trial
        salarySheetName = name
        break
      }
    }
  }

  if (Object.keys(structure).length === 0 && salarySheetName) {
    const sheet = getWorksheet(wb, salarySheetName)
    if (sheet) {
      structure = parseStructureFallbackScan(sheetToMatrix(sheet))
    }
  }

  if (Object.keys(structure).length === 0) {
    for (const name of sheetNames) {
      if (isSkipSheet(name)) continue
      const sheet = getWorksheet(wb, name)
      if (!sheet) continue
      const trial = parseStructureFallbackScan(sheetToMatrix(sheet))
      if (Object.keys(trial).length > 0) {
        structure = trial
        salarySheetName = name
        break
      }
    }
  }

  return { structure, salarySheetName }
}

/** Parse workbook from template or custom Excel with matching sheet/column layout. */
export function parseMasterWorkbook(wb: ExcelJS.Workbook): {
  company: Company
  structure: SalaryStructure
  employees: Employee[]
} {
  const { structure, salarySheetName } = parseStructureFromWorkbook(wb)

  let employees: Employee[] = []
  const employeeSheetName = findWorksheetName(wb, [
    'employee',
    'employees',
    'Employee',
    'Employees',
    'Employee Data',
    'Payroll',
  ])

  if (employeeSheetName) {
    const sheet = getWorksheet(wb, employeeSheetName)
    if (sheet) {
      employees = parseEmployeeSheet(sheet)
    }
  }

  const usedSheets = new Set(
    [salarySheetName, employeeSheetName].filter(Boolean) as string[],
  )

  if (employees.length === 0) {
    for (const name of getWorksheetNames(wb)) {
      if (isSkipSheet(name) || usedSheets.has(name)) continue
      const sheet = getWorksheet(wb, name)
      if (!sheet) continue
      const parsed = parseEmployeeSheet(sheet)
      if (parsed.length) {
        employees = parsed
        break
      }
    }
  }

  return { company: {}, structure, employees }
}

export async function readMasterExcelFromBuffer(buffer: Buffer): Promise<{
  company: Company
  structure: SalaryStructure
  employees: Employee[]
}> {
  const wb = await loadExcelWorkbook(buffer)
  const parsed = parseMasterWorkbook(wb)
  parsed.company = await readCompanyFromWorkbookBuffer(buffer)

  let fromStyles: SalaryStructure = {}
  try {
    fromStyles = await parseSalaryStructureWithExcelJS(buffer)
  } catch {
    /* keep matrix fallback */
  }

  const sheetNames = getWorksheetNames(wb)
  const salarySheet = resolveSalaryStructureSheetName(sheetNames)
  let fromNamedSheet: SalaryStructure = {}
  let fallbackStructure: SalaryStructure = {}
  if (salarySheet) {
    const sheet = getWorksheet(wb, salarySheet)
    if (sheet) {
      const matrix = sheetToMatrix(sheet)
      fromNamedSheet = parseStructureMatrix(matrix)
      if (Object.keys(fromNamedSheet).length === 0) {
        fromNamedSheet = parseStructureFallbackScan(matrix)
      }
      fallbackStructure = parseStructureFallbackScan(matrix)
    }
  }

  parsed.structure = combineSalaryStructureSources(
    fromNamedSheet,
    fromStyles,
    parsed.structure,
    fallbackStructure,
  )

  if (Object.keys(parsed.structure).length === 0) {
    throw new Error(
      'No pay components found on the salary_structure sheet. Add rows with Component name and Section = Earnings or Deductions.',
    )
  }

  return parsed
}

export async function readMasterExcel(filePath: string): Promise<{
  company: Company
  structure: SalaryStructure
  employees: Employee[]
}> {
  const { readFileSync } = await import('fs')
  const buffer = readFileSync(filePath)
  return readMasterExcelFromBuffer(buffer)
}

// ============================================================================
// BUILD PAYSLIP DOCUMENT
// ============================================================================
export function buildPayslip(
  company: Company,
  structure: SalaryStructure,
  emp: Employee
): Document {
  const payMonth = company['Pay Month'] || ''
  const payDate = company['Pay Date'] || ''
  const companyName = company['Company Name'] || '[COMPANY NAME]'

  const addr = [
    company['Address Line 1'],
    company['Address Line 2'],
    company['City'],
    company['State'],
    company['PIN'],
  ]
    .filter(Boolean)
    .join(' ')

  const gstin = safe(company['GSTIN'])
  const cpan = safe(company['Company PAN'])
  const phone = safe(company['Phone'])
  const email = safe(company['Email'])
  const website = safe(company['Website'])

  const payroll = buildPayslipPayrollSummary(emp, structure, company)

  // Build document
  const sections = []

  // =========================================================================
  // SECTION 1 - HEADER BAND
  // =========================================================================
  sections.push(
    new Paragraph({
      text: companyName,
      bold: true,
      size: 32,
      alignment: AlignmentType.CENTER,
      border: {
        bottom: { color: COLORS.PRIMARY, space: 1, style: BorderStyle.SINGLE, size: 6 },
      },
      spacing: { after: 200 },
    } as any)
  )

  // =========================================================================
  // SECTION 2 - TITLE STRIP
  // =========================================================================
  sections.push(
    new Paragraph({
      text: formatPayslipTitleLabel(payMonth),
      bold: true,
      size: 20,
      alignment: AlignmentType.CENTER,
      shading: { fill: COLORS.PRIMARY },
      color: COLORS.HEADER_TXT,
      spacing: { before: 100, after: 100 },
      border: {
        top: { color: COLORS.PRIMARY, space: 1, style: BorderStyle.SINGLE, size: 6 },
        bottom: { color: COLORS.PRIMARY, space: 1, style: BorderStyle.SINGLE, size: 6 },
      },
    } as any)
  )

  // =========================================================================
  // SECTION 3 - QUICK BAR
  // =========================================================================
  const paidDays = payroll.paidDays
  const lopDays = payroll.lopDays
  const workingDays = payroll.workingDays || company['Working Days']

  sections.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          cells: [
            createQuickBarCell('Pay Date', payDate),
            createQuickBarCell('Working Days', workingDays),
            createQuickBarCell('LOP Days', lopDays),
            createQuickBarCell('Paid Days', paidDays),
          ],
        } as any),
      ],
    } as any)
  )

  sections.push(new Paragraph({ text: '', spacing: { after: 200 } } as any))

  // =========================================================================
  // SECTION 4 - EMPLOYEE BLOCK
  // =========================================================================
  sections.push(
    new Paragraph({
      text: 'EMPLOYEE INFORMATION',
      bold: true,
      size: 18,
      shading: { fill: COLORS.PRIMARY },
      color: COLORS.HEADER_TXT,
      spacing: { before: 50, after: 50 },
    } as any)
  )

  sections.push(createEmployeeTable(emp, company))
  sections.push(new Paragraph({ text: '', spacing: { after: 200 } } as any))

  // =========================================================================
  // SECTION 5 - EARNINGS & DEDUCTIONS
  // =========================================================================
  sections.push(
    createEarningsDeductionsTable(
      payroll.earnings.map((e) => ({ name: e.name, amount: e.month })),
      payroll.gross,
      payroll.deductions.map((d) => ({ name: d.name, amount: d.month })),
      payroll.totalDeductions
    )
  )
  sections.push(new Paragraph({ text: '', spacing: { after: 200 } } as any))

  // =========================================================================
  // SECTION 6 - NET PAY
  // =========================================================================
  const netPay = payroll.netPay
  sections.push(
    new Paragraph({
      text: `NET PAY: Rs. ${formatAmount(netPay)}`,
      bold: true,
      size: 28,
      alignment: AlignmentType.CENTER,
      shading: { fill: COLORS.PRIMARY_LT },
      color: COLORS.PRIMARY_DK,
      spacing: { before: 100, after: 50 },
    } as any)
  )

  sections.push(
    new Paragraph({
      text: `Amount in Words: Indian Rupees ${numToIndianWords(netPay)} Only`,
      italic: true,
      size: 18,
      color: COLORS.PRIMARY_DK,
      spacing: { after: 200 },
    } as any)
  )

  // =========================================================================
  // FOOTER
  // =========================================================================
  sections.push(
    new Paragraph({
      text: companyName,
      bold: true,
      size: 14,
      alignment: AlignmentType.CENTER,
      color: COLORS.MUTED,
      spacing: { before: 100, after: 40 },
    } as any)
  )

  sections.push(
    new Paragraph({
      text: [`GSTIN: ${gstin}`, `PAN: ${cpan}`, `Email: ${email}`].join(' | '),
      size: 11,
      alignment: AlignmentType.CENTER,
      color: COLORS.MUTED,
      spacing: { after: 40 },
    } as any)
  )

  if (addr) {
    sections.push(
      new Paragraph({
        text: addr,
        size: 11,
        alignment: AlignmentType.CENTER,
        color: COLORS.MUTED,
        spacing: { after: 40 },
      } as any)
    )
  }

  const contactParts = [
    phone ? `Phone: ${phone}` : '',
    website ? `Website: ${website}` : '',
  ].filter(Boolean)
  if (contactParts.length) {
    sections.push(
      new Paragraph({
        text: contactParts.join(' | '),
        size: 11,
        alignment: AlignmentType.CENTER,
        color: COLORS.MUTED,
        spacing: { after: 40 },
      } as any)
    )
  }

  sections.push(
    new Paragraph({
      text: `This is a computer-generated payslip and does not require a physical signature.`,
      italic: true,
      size: 11,
      alignment: AlignmentType.CENTER,
      color: COLORS.MUTED,
      border: {
        top: { color: COLORS.PRIMARY, space: 1, style: BorderStyle.SINGLE, size: 4 },
      },
    } as any)
  )

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 200, right: 300, bottom: 400, left: 300 },
          },
        },
        children: sections,
      },
    ],
  } as any)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function createQuickBarCell(label: string, value: any): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        text: label.toUpperCase(),
        bold: true,
        size: 13,
        color: COLORS.MUTED,
        alignment: AlignmentType.CENTER,
      } as any),
      new Paragraph({
        text: safe(value),
        bold: true,
        size: 20,
        color: COLORS.PRIMARY_DK,
        alignment: AlignmentType.CENTER,
      } as any),
    ],
    shading: { fill: COLORS.PRIMARY_LT },
    borders: {
      top: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
      bottom: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
      left: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
      right: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
    },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
  } as any)
}

function createEmployeeTable(emp: Employee, company: Company): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        cells: [
          createEmpCell('Emp ID', emp['Emp ID']),
          createEmpCell('Designation', emp['Designation']),
          createEmpCell('Location', emp['Location']),
        ],
      } as any),
      new TableRow({
        cells: [
          createEmpCell('Name', formatPayslipPersonName(emp['Name'])),
          createEmpCell('Department', emp['Department']),
          createEmpCell('Branch', emp['Branch']),
        ],
      } as any),
      new TableRow({
        cells: [
          createEmpCell('Date of Birth', emp['Date of Birth']),
          createEmpCell('Grade / Band', emp['Grade']),
          createEmpCell('Cost Centre', emp['Cost Centre']),
        ],
      } as any),
      new TableRow({
        cells: [
          createEmpCell('Date of Joining', emp['Date of Joining']),
          createEmpCell('Reporting To', emp['Reporting To']),
          createEmpCell('Employment Type', emp['Employment Type']),
        ],
      } as any),
    ],
  } as any)
}

function createEmpCell(label: string, value: any): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        text: label,
        bold: true,
        size: 16,
        color: COLORS.PRIMARY_DK,
      } as any),
      new Paragraph({
        text: safe(value),
        size: 16,
      } as any),
    ],
    shading: { fill: COLORS.LABEL_BG },
    borders: {
      top: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
      bottom: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
      left: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
      right: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
    },
  } as any)
}

interface EarningItem {
  name: string
  amount: number
}

/** Legacy short column names on the employee sheet → salary structure component. */
const COMPONENT_ALIASES: Record<string, string[]> = {
  'Basic Salary': ['Basic', 'Basic Salary'],
  'House Rent Allowance': ['HRA'],
  'Conveyance (Non-taxable)': ['Conveyance'],
  'Leave Travel Allowance': ['LTA'],
  'Professional Tax': ['PT'],
  'Income Tax (TDS)': ['TDS'],
  'Employee Provident Fund': ['EPF', 'PF', 'Provident Fund'],
  'Loan / Advance Recovery': ['Loan Recovery', 'Loan / Adv. Recovery'],
  'LOP Deduction': ['LOP', 'LOP Amount', 'Loss of Pay'],
  'Loss of Pay': ['LOP Deduction'],
}

function parseAmount(v: unknown): number {
  try {
    const n = parseFloat(String(v))
    return Number.isNaN(n) ? 0 : n
  } catch {
    return 0
  }
}

function resolveComponentAmount(
  emp: Employee,
  componentName: string,
  meta: SalaryComponentMeta
): number {
  const candidates = [componentName, ...(COMPONENT_ALIASES[componentName] ?? [])]
  for (const key of candidates) {
    const val = emp[key]
    if (val !== undefined && val !== null && val !== '') {
      return parseAmount(val)
    }
  }
  const lower = componentName.toLowerCase()
  for (const key of Object.keys(emp)) {
    if (cellToString(key).toLowerCase() === lower) {
      return parseAmount(emp[key])
    }
  }
  const amt = meta.default ?? 0
  return amt
}

function matchesSection(meta: SalaryComponentMeta, section: 'Earnings' | 'Deductions'): boolean {
  if (meta.section === section) return true
  const s = String(meta.section ?? '').toLowerCase()
  if (section === 'Earnings') return s.includes('earning')
  return s.includes('deduction')
}

function orderedComponents(structure: SalaryStructure, section: 'Earnings' | 'Deductions'): string[] {
  return Object.entries(structure)
    .filter(([, meta]) => matchesSection(meta, section))
    .sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0))
    .map(([name]) => name)
}

export function buildEarningsData(emp: Employee, structure: SalaryStructure): { earnings: EarningItem[]; gross: number } {
  const earnings: EarningItem[] = []
  let gross = 0

  for (const name of orderedComponents(structure, 'Earnings')) {
    const meta = structure[name]
    const amount = resolveComponentAmount(emp, name, meta)
    earnings.push({ name, amount })
    gross += amount
  }

  return { earnings, gross }
}

export function buildDeductionsData(
  emp: Employee,
  structure: SalaryStructure
): { deductions: EarningItem[]; totalDed: number } {
  const deductions: EarningItem[] = []
  let totalDed = 0

  for (const name of orderedComponents(structure, 'Deductions')) {
    if (name === 'Loss of Pay' || name === 'LOP Deduction') continue
    const meta = structure[name]
    const amount = resolveComponentAmount(emp, name, meta)
    deductions.push({ name, amount })
    totalDed += amount
  }

  return { deductions, totalDed }
}

export type PayslipPayrollLine = {
  name: string
  month: number
  ytd: number
}

export type PayslipPayrollSummary = {
  earnings: PayslipPayrollLine[]
  deductions: PayslipPayrollLine[]
  gross: number
  grossYtd: number
  totalDeductions: number
  totalDedYtd: number
  netPay: number
  lopDays: number
  lopAmount: number
  workingDays: number
  paidDays: number
}

export function roundPayrollAmount(value: number): number {
  return Math.round(value * 100) / 100
}

/** Resolve YTD: prefer FY cumulative map from payrollYtdService (Apr–Mar); Excel YTD columns are fallback only. */
export function getComponentYtd(
  emp: Employee,
  componentName: string,
  monthAmount: number
): number {
  const ytdMap = emp['_componentYtd'] as Record<string, number> | undefined
  if (ytdMap !== undefined) {
    return roundPayrollAmount(ytdMap[componentName] ?? monthAmount)
  }
  for (const key of [`${componentName} YTD`, `YTD ${componentName}`, `${componentName} Ytd`]) {
    if (emp[key] !== undefined && emp[key] !== '') {
      return parseAmount(emp[key])
    }
  }
  return roundPayrollAmount(monthAmount)
}

export function resolvePaidDays(
  emp: Employee,
  company: Company
): { workingDays: number; lopDays: number; paidDays: number } {
  const lopDays = parseAmount(emp['LOP Days'])
  const workingDays = parseAmount(company['Working Days'])
  const paidFromEmp = parseAmount(emp['Paid Days'])
  const paidDays =
    paidFromEmp > 0
      ? paidFromEmp
      : workingDays > 0
        ? Math.max(0, workingDays - lopDays)
        : 0
  return { workingDays, lopDays, paidDays }
}

export function resolveLopAmount(
  emp: Employee,
  structure: SalaryStructure,
  gross: number,
  lopDays: number,
  paidDays: number
): number {
  const explicit =
    parseAmount(emp['LOP Deduction']) ||
    parseAmount(emp['Loss of Pay'])
  if (explicit > 0) return roundPayrollAmount(explicit)
  if (lopDays > 0 && gross > 0 && paidDays > 0) {
    return roundPayrollAmount((gross / paidDays) * lopDays)
  }
  return roundPayrollAmount(
    parseAmount(structure['LOP Deduction']?.default) ||
      parseAmount(structure['Loss of Pay']?.default),
  )
}

function isLopDeductionComponent(name: string): boolean {
  return name === 'Loss of Pay' || name === 'LOP Deduction'
}

function lopDeductionYtd(emp: Employee, lopAmount: number): number {
  const ytdMap = emp['_componentYtd'] as Record<string, number> | undefined
  if (ytdMap && (ytdMap['LOP Deduction'] != null || ytdMap['Loss of Pay'] != null)) {
    return roundPayrollAmount(ytdMap['LOP Deduction'] ?? ytdMap['Loss of Pay'] ?? lopAmount)
  }
  return getComponentYtd(emp, 'LOP Deduction', lopAmount)
}

/** Single source of truth for earnings, deductions, totals, and net pay. */
export function buildPayslipPayrollSummary(
  emp: Employee,
  structure: SalaryStructure,
  company: Company
): PayslipPayrollSummary {
  const { earnings, gross: structureGross } = buildEarningsData(emp, structure)
  const { deductions } = buildDeductionsData(emp, structure)
  const { workingDays, lopDays, paidDays } = resolvePaidDays(emp, company)
  const lopAmount = resolveLopAmount(emp, structure, structureGross, lopDays, paidDays)

  const earningsLines: PayslipPayrollLine[] = earnings.map((e) => ({
    name: e.name,
    month: e.amount,
    ytd: getComponentYtd(emp, e.name, e.amount),
  }))

  const deductionLines: PayslipPayrollLine[] = []
  const structureDeductions = orderedComponents(structure, 'Deductions')
  let lopInserted = false

  for (const name of structureDeductions) {
    if (isLopDeductionComponent(name)) {
      if (!lopInserted) {
        deductionLines.push({
          name: 'LOP Deduction',
          month: lopAmount,
          ytd: lopDeductionYtd(emp, lopAmount),
        })
        lopInserted = true
      }
      continue
    }
    const fromBuilt = deductions.find((d) => d.name === name)
    const meta = structure[name]
    const amount = fromBuilt?.amount ?? resolveComponentAmount(emp, name, meta)
    deductionLines.push({
      name,
      month: amount,
      ytd: getComponentYtd(emp, name, amount),
    })
  }

  if (!lopInserted && structureDeductions.length === 0) {
    for (const d of deductions) {
      deductionLines.push({
        name: d.name,
        month: d.amount,
        ytd: getComponentYtd(emp, d.name, d.amount),
      })
    }
    if (lopAmount > 0 || lopDays > 0) {
      deductionLines.push({
        name: 'LOP Deduction',
        month: lopAmount,
        ytd: lopDeductionYtd(emp, lopAmount),
      })
    }
  } else if (!lopInserted) {
    deductionLines.push({
      name: 'LOP Deduction',
      month: lopAmount,
      ytd: lopDeductionYtd(emp, lopAmount),
    })
  }

  const gross = roundPayrollAmount(earningsLines.reduce((sum, row) => sum + row.month, 0))
  const grossYtd = roundPayrollAmount(earningsLines.reduce((sum, row) => sum + row.ytd, 0))
  const totalDeductions = roundPayrollAmount(
    deductionLines.reduce((sum, row) => sum + row.month, 0)
  )
  const totalDedYtd = roundPayrollAmount(
    deductionLines.reduce((sum, row) => sum + row.ytd, 0)
  )
  const netPay = roundPayrollAmount(gross - totalDeductions)

  return {
    earnings: earningsLines,
    deductions: deductionLines,
    gross,
    grossYtd,
    totalDeductions,
    totalDedYtd,
    netPay,
    lopDays,
    lopAmount,
    workingDays,
    paidDays,
  }
}

/** Net pay (take-home) — gross earnings minus all deductions including LOP. */
export function computeNetPay(
  emp: Employee,
  structure: SalaryStructure,
  company: Company
): number {
  return buildPayslipPayrollSummary(emp, structure, company).netPay
}

function createEarningsDeductionsTable(
  earnings: EarningItem[],
  gross: number,
  deductions: EarningItem[],
  totalDed: number
): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        cells: [
          new TableCell({
            children: [new Paragraph({ text: 'EARNINGS', bold: true, size: 18, color: COLORS.HEADER_TXT } as any)],
            shading: { fill: COLORS.PRIMARY },
            borders: {
              top: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              bottom: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              left: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              right: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
            },
          } as any),
          new TableCell({
            children: [new Paragraph({ text: 'DEDUCTIONS', bold: true, size: 18, color: COLORS.HEADER_TXT } as any)],
            shading: { fill: COLORS.PRIMARY },
            borders: {
              top: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              bottom: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              left: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              right: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
            },
          } as any),
        ],
      } as any),
      ...earnings.map((e, i) =>
        new TableRow({
          cells: [
            new TableCell({
              children: [
                new Paragraph({
                  text: e.name,
                  size: 16,
                } as any),
                new Paragraph({
                  text: `Rs. ${formatAmount(e.amount)}`,
                  bold: true,
                  size: 16,
                  alignment: AlignmentType.RIGHT,
                } as any),
              ],
              shading: i % 2 === 0 ? { fill: COLORS.ROW_ALT } : undefined,
              borders: {
                top: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
                bottom: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
                left: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
                right: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              },
            } as any),
            new TableCell({
              children: [
                new Paragraph({
                  text: deductions[i]?.name || '',
                  size: 16,
                } as any),
                new Paragraph({
                  text: `Rs. ${formatAmount(deductions[i]?.amount || 0)}`,
                  bold: true,
                  size: 16,
                  alignment: AlignmentType.RIGHT,
                } as any),
              ],
              shading: i % 2 === 0 ? { fill: COLORS.ROW_ALT } : undefined,
              borders: {
                top: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
                bottom: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
                left: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
                right: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              },
            } as any),
          ],
        } as any)
      ),
      new TableRow({
        cells: [
          new TableCell({
            children: [
              new Paragraph({
                text: 'GROSS EARNINGS',
                bold: true,
                size: 18,
              } as any),
              new Paragraph({
                text: `Rs. ${formatAmount(gross)}`,
                bold: true,
                size: 18,
                alignment: AlignmentType.RIGHT,
              } as any),
            ],
            shading: { fill: COLORS.PRIMARY_LT },
            borders: {
              top: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              bottom: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              left: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              right: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
            },
          } as any),
          new TableCell({
            children: [
              new Paragraph({
                text: 'TOTAL DEDUCTIONS',
                bold: true,
                size: 18,
              } as any),
              new Paragraph({
                text: `Rs. ${formatAmount(totalDed)}`,
                bold: true,
                size: 18,
                alignment: AlignmentType.RIGHT,
              } as any),
            ],
            shading: { fill: COLORS.PRIMARY_LT },
            borders: {
              top: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              bottom: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              left: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              right: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
            },
          } as any),
        ],
      } as any),
    ],
  } as any)
}

export async function savePayslipAsDocx(doc: Document, outputPath: string): Promise<void> {
  const { Packer } = await import('docx')
  return new Promise((resolve, reject) => {
    Packer.toBuffer(doc).then((buffer) => {
      writeFileSync(outputPath, buffer)
      resolve()
    })
  })
}
