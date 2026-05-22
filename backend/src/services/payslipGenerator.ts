import * as XLSX from 'xlsx'
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
  ConvertInchesToTwip,
} from 'docx'
import { writeFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// THEME COLORS (same as Python version)
// ============================================================================
const COLORS = {
  PRIMARY: '0E5E4E',
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

export interface SalaryStructure {
  [key: string]: { section: string; default: number }
}

export interface Employee {
  [key: string]: any
}

function findSheetName(wb: XLSX.WorkBook, candidates: string[]): string | undefined {
  for (const name of candidates) {
    if (wb.Sheets[name]) return name
  }
  const lower = candidates.map((n) => n.toLowerCase())
  for (const sheetName of wb.SheetNames) {
    if (lower.includes(sheetName.toLowerCase())) {
      return sheetName
    }
  }
  return undefined
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

function parseCompanySheet(ws: XLSX.WorkSheet): Company {
  const company: Company = {}
  const companyData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]
  const skipLabels = new Set(['company details', 'field', 'value', ''])

  for (const row of companyData) {
    if (!row || !row[0]) continue
    const label = String(row[0]).trim()
    if (skipLabels.has(label.toLowerCase())) continue
    if (row[1] === undefined || row[1] === null || row[1] === '') continue
    company[label] = row[1]
  }
  return company
}

function parseSalaryStructureSheet(ws: XLSX.WorkSheet): SalaryStructure {
  const structure: SalaryStructure = {}
  const salaryData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]

  let startRow = salaryData.findIndex(
    (row) => row && String(row[0] || '').trim().toLowerCase() === 'component'
  )
  if (startRow >= 0) startRow += 1
  else startRow = 1

  for (let i = startRow; i < salaryData.length; i++) {
    const row = salaryData[i]
    if (!row || !row[0]) continue
    const comp = String(row[0]).trim()
    const sec = String(row[1] || '').trim()
    const rawAmt = row[2]
    let amt = 0
    if (rawAmt !== '' && rawAmt !== null && rawAmt !== undefined) {
      try {
        amt = typeof rawAmt === 'number' ? rawAmt : parseFloat(String(rawAmt))
        if (Number.isNaN(amt)) amt = 0
      } catch {
        amt = 0
      }
    }
    structure[comp] = { section: sec, default: amt }
  }
  return structure
}

function parseEmployeeSheet(ws: XLSX.WorkSheet): Employee[] {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
  let headerIdx = rows.findIndex(
    (row) => String(row?.[0] ?? '').trim().toLowerCase() === 'emp id'
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

/** Parse workbook from template or custom Excel with matching sheet/column layout. */
export function parseMasterWorkbook(wb: XLSX.WorkBook): {
  company: Company
  structure: SalaryStructure
  employees: Employee[]
} {
  const companySheetName = findSheetName(wb, ['company', 'Company', 'Company Info', 'Company Details'])
  const wsCompany = companySheetName ? wb.Sheets[companySheetName] : undefined
  const company = wsCompany ? parseCompanySheet(wsCompany) : {}

  const salarySheetName = findSheetName(wb, [
    'salary structure',
    'Salary Structure',
    'SalaryStructure',
    'Structure',
  ])
  const wsSalary = salarySheetName ? wb.Sheets[salarySheetName] : undefined
  const structure = wsSalary ? parseSalaryStructureSheet(wsSalary) : {}

  let employees: Employee[] = []
  const employeeSheetName = findSheetName(wb, [
    'employee',
    'employees',
    'Employee',
    'Employees',
    'Employee Data',
    'Payroll',
  ])
  const wsEmployees = employeeSheetName ? wb.Sheets[employeeSheetName] : undefined

  if (wsEmployees) {
    employees = parseEmployeeSheet(wsEmployees)
  }

  const usedSheets = new Set(
    [companySheetName, salarySheetName, employeeSheetName].filter(Boolean) as string[]
  )

  if (employees.length === 0) {
    for (const sheetName of wb.SheetNames) {
      if (isSkipSheet(sheetName) || usedSheets.has(sheetName)) continue
      const parsed = parseEmployeeSheet(wb.Sheets[sheetName])
      if (parsed.length) {
        employees = parsed
        break
      }
    }
  }

  return { company, structure, employees }
}

export function readMasterExcelFromBuffer(buffer: Buffer): {
  company: Company
  structure: SalaryStructure
  employees: Employee[]
} {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  return parseMasterWorkbook(wb)
}

export function readMasterExcel(filePath: string): {
  company: Company
  structure: SalaryStructure
  employees: Employee[]
} {
  const wb = XLSX.readFile(filePath)
  return parseMasterWorkbook(wb)
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

  // Build address
  const addr = [
    company['Address Line 1'],
    company['Address Line 2'],
    company['City'],
    company['State'],
    company['PIN'],
  ]
    .filter(Boolean)
    .join(' ')

  const cin = safe(company['CIN'])
  const gstin = safe(company['GSTIN'])
  const cpan = safe(company['Company PAN'])
  const phone = safe(company['Phone'])
  const email = safe(company['Email'])
  const website = safe(company['Website'])

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
      border: {
        bottom: { color: COLORS.PRIMARY, space: 1, style: BorderStyle.SINGLE, size: 6 },
      },
      spacing: { after: 100 },
    })
  )

  sections.push(
    new Paragraph({
      text: `CIN: ${cin}    GSTIN: ${gstin}    PAN: ${cpan}`,
      size: 14,
      color: COLORS.MUTED,
      spacing: { after: 50 },
    })
  )

  sections.push(
    new Paragraph({
      text: addr,
      size: 14,
      italic: true,
      color: COLORS.MUTED,
      spacing: { after: 200 },
    })
  )

  // =========================================================================
  // SECTION 2 - TITLE STRIP
  // =========================================================================
  sections.push(
    new Paragraph({
      text: `PAYSLIP for the Pay Period of ${payMonth?.toString().toUpperCase()}`,
      bold: true,
      size: 28,
      alignment: AlignmentType.CENTER,
      shading: { fill: COLORS.PRIMARY },
      color: COLORS.HEADER_TXT,
      spacing: { before: 100, after: 100 },
      border: {
        top: { color: COLORS.PRIMARY, space: 1, style: BorderStyle.SINGLE, size: 6 },
        bottom: { color: COLORS.PRIMARY, space: 1, style: BorderStyle.SINGLE, size: 6 },
      },
    })
  )

  // =========================================================================
  // SECTION 3 - QUICK BAR
  // =========================================================================
  const paidDays = emp['Paid Days'] || company['Working Days']
  const lopDays = emp['LOP Days'] || 0

  sections.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          cells: [
            createQuickBarCell('Pay Date', payDate),
            createQuickBarCell('Working Days', company['Working Days']),
            createQuickBarCell('LOP Days', lopDays),
            createQuickBarCell('Paid Days', paidDays),
          ],
        }),
      ],
    })
  )

  sections.push(new Paragraph({ text: '', spacing: { after: 200 } }))

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
    })
  )

  sections.push(createEmployeeTable(emp, company))
  sections.push(new Paragraph({ text: '', spacing: { after: 200 } }))

  // =========================================================================
  // SECTION 5 - EARNINGS & DEDUCTIONS
  // =========================================================================
  const { earnings, gross } = buildEarningsData(emp, structure)
  const { deductions, totalDed } = buildDeductionsData(emp, structure)

  sections.push(createEarningsDeductionsTable(earnings, gross, deductions, totalDed))
  sections.push(new Paragraph({ text: '', spacing: { after: 200 } }))

  // =========================================================================
  // SECTION 6 - NET PAY
  // =========================================================================
  const netPay = gross - totalDed
  sections.push(
    new Paragraph({
      text: `NET PAY: Rs. ${formatAmount(netPay)}`,
      bold: true,
      size: 28,
      alignment: AlignmentType.CENTER,
      shading: { fill: COLORS.PRIMARY_LT },
      color: COLORS.PRIMARY_DK,
      spacing: { before: 100, after: 50 },
    })
  )

  sections.push(
    new Paragraph({
      text: `Amount in Words: Indian Rupees ${numToIndianWords(netPay)} Only`,
      italic: true,
      size: 18,
      color: COLORS.PRIMARY_DK,
      spacing: { after: 200 },
    })
  )

  // =========================================================================
  // FOOTER
  // =========================================================================
  sections.push(
    new Paragraph({
      text: `This is a computer-generated payslip and does not require a physical signature.`,
      italic: true,
      size: 12,
      alignment: AlignmentType.CENTER,
      color: COLORS.MUTED,
      border: {
        top: { color: COLORS.PRIMARY, space: 1, style: BorderStyle.SINGLE, size: 4 },
      },
    })
  )

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margins: { top: 200, right: 300, bottom: 400, left: 300 },
          },
        },
        children: sections,
      },
    ],
  })
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
      }),
      new Paragraph({
        text: safe(value),
        bold: true,
        size: 20,
        color: COLORS.PRIMARY_DK,
        alignment: AlignmentType.CENTER,
      }),
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
  })
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
      }),
      new TableRow({
        cells: [
          createEmpCell('Name', emp['Name']),
          createEmpCell('Department', emp['Department']),
          createEmpCell('Branch', emp['Branch']),
        ],
      }),
      new TableRow({
        cells: [
          createEmpCell('Date of Birth', emp['Date of Birth']),
          createEmpCell('Grade / Band', emp['Grade']),
          createEmpCell('Cost Centre', emp['Cost Centre']),
        ],
      }),
      new TableRow({
        cells: [
          createEmpCell('Date of Joining', emp['Date of Joining']),
          createEmpCell('Reporting To', emp['Reporting To']),
          createEmpCell('Employment Type', emp['Employment Type']),
        ],
      }),
    ],
  })
}

function createEmpCell(label: string, value: any): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        text: label,
        bold: true,
        size: 16,
        color: COLORS.PRIMARY_DK,
      }),
      new Paragraph({
        text: safe(value),
        size: 16,
      }),
    ],
    shading: { fill: COLORS.LABEL_BG },
    borders: {
      top: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
      bottom: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
      left: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
      right: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
    },
  })
}

interface EarningItem {
  name: string
  amount: number
}

export function buildEarningsData(emp: Employee, structure: SalaryStructure): { earnings: EarningItem[]; gross: number } {
  const empToStruct: { [key: string]: string } = {
    'Basic Salary': 'Basic Salary',
    HRA: 'House Rent Allowance',
    Conveyance: 'Conveyance (Non-taxable)',
    'Sundry Medical': 'Sundry Medical',
    LTA: 'Leave Travel Allowance',
    'Variable Allowance': 'Variable Allowance',
    'Personal Allowance': 'Personal Allowance',
    'Special Allowance': 'Special Allowance',
    Reimbursements: 'Reimbursements',
  }

  const earnings: EarningItem[] = []
  let gross = 0

  for (const [empCol, structName] of Object.entries(empToStruct)) {
    let v = emp[empCol]
    if (!v) {
      v = structure[structName]?.default || 0
    }
    try {
      v = parseFloat(String(v))
    } catch {
      v = 0
    }
    earnings.push({ name: structName, amount: v })
    gross += v
  }

  return { earnings, gross }
}

export function buildDeductionsData(
  emp: Employee,
  structure: SalaryStructure
): { deductions: EarningItem[]; totalDed: number } {
  const empToStruct: { [key: string]: string } = {
    PT: 'Professional Tax',
    TDS: 'Income Tax (TDS)',
    'Loan Recovery': 'Loan / Advance Recovery',
    'LOP Days': 'Loss of Pay',
  }

  const deductions: EarningItem[] = []
  let totalDed = 0

  for (const [empCol, structName] of Object.entries(empToStruct)) {
    let v = emp[empCol]
    if (!v) {
      v = structure[structName]?.default || 0
    }
    try {
      v = parseFloat(String(v))
    } catch {
      v = 0
    }
    deductions.push({ name: structName, amount: v })
    totalDed += v
  }

  return { deductions, totalDed }
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
            children: [new Paragraph({ text: 'EARNINGS', bold: true, size: 18, color: COLORS.HEADER_TXT })],
            shading: { fill: COLORS.PRIMARY },
            borders: {
              top: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              bottom: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              left: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              right: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
            },
          }),
          new TableCell({
            children: [new Paragraph({ text: 'DEDUCTIONS', bold: true, size: 18, color: COLORS.HEADER_TXT })],
            shading: { fill: COLORS.PRIMARY },
            borders: {
              top: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              bottom: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              left: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              right: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
            },
          }),
        ],
      }),
      ...earnings.map((e, i) =>
        new TableRow({
          cells: [
            new TableCell({
              children: [
                new Paragraph({
                  text: e.name,
                  size: 16,
                }),
                new Paragraph({
                  text: `Rs. ${formatAmount(e.amount)}`,
                  bold: true,
                  size: 16,
                  alignment: AlignmentType.RIGHT,
                }),
              ],
              shading: i % 2 === 0 ? { fill: COLORS.ROW_ALT } : undefined,
              borders: {
                top: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
                bottom: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
                left: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
                right: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  text: deductions[i]?.name || '',
                  size: 16,
                }),
                new Paragraph({
                  text: `Rs. ${formatAmount(deductions[i]?.amount || 0)}`,
                  bold: true,
                  size: 16,
                  alignment: AlignmentType.RIGHT,
                }),
              ],
              shading: i % 2 === 0 ? { fill: COLORS.ROW_ALT } : undefined,
              borders: {
                top: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
                bottom: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
                left: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
                right: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              },
            }),
          ],
        })
      ),
      new TableRow({
        cells: [
          new TableCell({
            children: [
              new Paragraph({
                text: 'GROSS EARNINGS',
                bold: true,
                size: 18,
              }),
              new Paragraph({
                text: `Rs. ${formatAmount(gross)}`,
                bold: true,
                size: 18,
                alignment: AlignmentType.RIGHT,
              }),
            ],
            shading: { fill: COLORS.PRIMARY_LT },
            borders: {
              top: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              bottom: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              left: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              right: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                text: 'TOTAL DEDUCTIONS',
                bold: true,
                size: 18,
              }),
              new Paragraph({
                text: `Rs. ${formatAmount(totalDed)}`,
                bold: true,
                size: 18,
                alignment: AlignmentType.RIGHT,
              }),
            ],
            shading: { fill: COLORS.PRIMARY_LT },
            borders: {
              top: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              bottom: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              left: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
              right: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
            },
          }),
        ],
      }),
    ],
  })
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
