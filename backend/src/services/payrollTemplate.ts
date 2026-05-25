import ExcelJS from 'exceljs'

/** Brand colors matching the payroll master template */
const GREEN_DK = 'FF0E5E4E'
const GREEN_LT = 'FFEAF3EE'
const WHITE = 'FFFFFFFF'
const PEACH = 'FFFDE8D8'
const BORDER = 'FFB7C9BC'
const TEXT = 'FF1F2937'
const MUTED = 'FF6B7280'

function styleHeaderRow(row: ExcelJS.Row, colCount: number) {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_DK } }
    cell.font = { bold: true, color: { argb: WHITE }, size: 11 }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = thinBorder()
  }
  row.height = 22
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: BORDER } }
  return { top: side, bottom: side, left: side, right: side }
}

function styleLabelCell(cell: ExcelJS.Cell) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_LT } }
  cell.font = { bold: true, color: { argb: GREEN_DK }, size: 10 }
  cell.alignment = { vertical: 'middle', wrapText: true }
  cell.border = thinBorder()
}

function styleValueCell(cell: ExcelJS.Cell) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WHITE } }
  cell.font = { color: { argb: TEXT }, size: 10 }
  cell.alignment = { vertical: 'middle', wrapText: true }
  cell.border = thinBorder()
}

/** Demo payroll Excel: employee, company, salary structure, readme */
export async function generatePayrollTemplateBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'EPICAL HRMS'
  wb.created = new Date()

  // ── Sheet 1: employee ─────────────────────────────────────────
  const empSheet = wb.addWorksheet('employee', {
    views: [{ state: 'frozen', ySplit: 4 }],
  })
  empSheet.columns = [
    { width: 12 },
    { width: 22 },
    { width: 18 },
    { width: 16 },
    { width: 12 },
    { width: 10 },
    { width: 14 },
    { width: 10 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
    { width: 10 },
    { width: 12 },
    { width: 12 },
    { width: 10 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 10 },
    { width: 10 },
    { width: 14 },
  ]

  empSheet.mergeCells('A1:Z1')
  const empTitle = empSheet.getCell('A1')
  empTitle.value = 'EMPLOYEE PAYROLL DATA'
  empTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_DK } }
  empTitle.font = { bold: true, color: { argb: WHITE }, size: 12 }
  empTitle.alignment = { horizontal: 'center', vertical: 'middle' }
  empSheet.getRow(1).height = 24

  empSheet.mergeCells('A2:Z2')
  empSheet.getCell('A2').value =
    'Enter one employee per row. Headers are on row 4 — do not delete or rename header columns.'
  empSheet.getCell('A2').font = { italic: true, color: { argb: MUTED }, size: 9 }
  empSheet.getRow(2).height = 18

  empSheet.getRow(3).height = 8

  const empHeaders = [
    'Emp ID',
    'Name',
    'Designation',
    'Department',
    'Location',
    'Branch',
    'Date of Birth',
    'Grade',
    'Cost Centre',
    'Date of Joining',
    'Reporting To',
    'Employment Type',
    'Paid Days',
    'LOP Days',
    'Basic Salary',
    'HRA',
    'Conveyance',
    'Sundry Medical',
    'LTA',
    'Variable Allowance',
    'Personal Allowance',
    'Special Allowance',
    'Reimbursements',
    'PT',
    'TDS',
    'Loan Recovery',
  ]
  const headerRow = empSheet.getRow(4)
  empHeaders.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
  })
  styleHeaderRow(headerRow, empHeaders.length)

  const sampleEmployees = [
    [
      'E-1001',
      'Ravi Kumar',
      'Software Engineer',
      'Engineering',
      'Chennai',
      'HQ',
      '15-Mar-1995',
      'L2',
      'CC-ENG-01',
      '01-Jun-2022',
      'Tech Lead',
      'Full Time',
      26,
      0,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ],
    [
      'E-1002',
      'Priya Sharma',
      'HR Executive',
      'Human Resources',
      'Chennai',
      'HQ',
      '22-Jul-1998',
      'L1',
      'CC-HR-01',
      '10-Jan-2023',
      'HR Manager',
      'Full Time',
      26,
      0,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ],
  ]
  sampleEmployees.forEach((row, idx) => {
    const r = empSheet.getRow(5 + idx)
    row.forEach((val, i) => {
      const cell = r.getCell(i + 1)
      cell.value = val
      cell.border = thinBorder()
      if (idx % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F9F6' } }
      }
    })
  })

  // ── Sheet 2: company ──────────────────────────────────────────
  const coSheet = wb.addWorksheet('company')
  coSheet.getColumn(1).width = 22
  coSheet.getColumn(2).width = 42

  coSheet.mergeCells('A1:B1')
  const coTitle = coSheet.getCell('A1')
  coTitle.value = 'COMPANY DETAILS'
  coTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_DK } }
  coTitle.font = { bold: true, color: { argb: WHITE }, size: 12 }
  coTitle.alignment = { horizontal: 'center', vertical: 'middle' }
  coSheet.getRow(1).height = 24

  const companyFields: [string, string | number][] = [
    ['Company Name', 'Epical Layouts Pvt Ltd'],
    ['CIN', ''],
    ['GSTIN', '33AAFCE7686L1Z3'],
    ['Company PAN', 'AAFCE7686L'],
    ['Address Line 1', '15, 2nd Bhajanai Koil St, Sembakkam'],
    ['Address Line 2', 'Rajakilpakkam'],
    ['City', 'Chennai'],
    ['State', 'Tamil Nadu'],
    ['PIN', '600073'],
    ['Phone', ''],
    ['Email', 'info@epicallayouts.com'],
    ['Website', ''],
    ['Pay Month', 'April 2026'],
    ['Pay Date', '30-Apr-2026'],
    ['Working Days', 26],
    ['Default Tax Regime', 'New'],
  ]

  companyFields.forEach(([label, value], i) => {
    const r = coSheet.getRow(i + 2)
    const labelCell = r.getCell(1)
    const valueCell = r.getCell(2)
    labelCell.value = label
    valueCell.value = value
    styleLabelCell(labelCell)
    styleValueCell(valueCell)
    r.height = 20
  })

  // ── Sheet 3: salary structure ─────────────────────────────────
  const salSheet = wb.addWorksheet('salary structure')
  salSheet.columns = [{ width: 28 }, { width: 14 }, { width: 16 }, { width: 36 }]

  const salHeader = salSheet.getRow(1)
  ;['Component', 'Section', 'Default Amount', 'Notes'].forEach((h, i) => {
    salHeader.getCell(i + 1).value = h
  })
  styleHeaderRow(salHeader, 4)

  const components: [string, string, number | string, string][] = [
    ['Basic Salary', 'Earnings', '', 'Foundation of salary'],
    ['House Rent Allowance', 'Earnings', '', 'Usually 40-50% of Basic'],
    ['Conveyance (Non-taxable)', 'Earnings', '', ''],
    ['Sundry Medical', 'Earnings', '', ''],
    ['Leave Travel Allowance', 'Earnings', '', ''],
    ['Variable Allowance', 'Earnings', '', ''],
    ['Personal Allowance', 'Earnings', '', ''],
    ['Special Allowance', 'Earnings', '', 'Balancing allowance'],
    ['Reimbursements', 'Earnings', '', 'Telephone, internet, fuel etc.'],
    ['Professional Tax', 'Deductions', 0, 'State-level tax'],
    ['Income Tax (TDS)', 'Deductions', 0, 'Tax deducted at source'],
    ['Loan / Advance Recovery', 'Deductions', 0, 'EMI or one-time recovery'],
    ['Loss of Pay', 'Deductions', 0, 'Deduction for unpaid leaves'],
  ]

  components.forEach(([comp, section, amt, notes], i) => {
    const r = salSheet.getRow(i + 2)
    const isDeduction = section === 'Deductions'
    ;[comp, section, amt, notes].forEach((val, j) => {
      const cell = r.getCell(j + 1)
      cell.value = val
      cell.border = thinBorder()
      cell.font = { size: 10, color: { argb: TEXT } }
      if (isDeduction) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PEACH } }
      } else if (j === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WHITE } }
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WHITE } }
      }
      if (j === 3) cell.font = { size: 9, italic: true, color: { argb: MUTED } }
    })
    r.height = 18
  })

  // ── Sheet 4: readme ───────────────────────────────────────────
  const readmeSheet = wb.addWorksheet('readme')
  readmeSheet.getColumn(1).width = 90

  readmeSheet.mergeCells('A1:A1')
  const readmeTitle = readmeSheet.getCell('A1')
  readmeTitle.value = 'PAYROLL MASTER – HOW TO USE'
  readmeTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_DK } }
  readmeTitle.font = { bold: true, color: { argb: WHITE }, size: 14 }
  readmeTitle.alignment = { horizontal: 'center', vertical: 'middle' }
  readmeSheet.getRow(1).height = 28

  const readmeLines = [
    '',
    'Sheet: company',
    '→ Fill company details (label in col A, value in col B).',
    '',
    'Sheet: salary structure',
    '→ Set default monthly amounts for each pay component.',
    '',
    'Sheet: employee',
    '→ One employee per row from row 4 (headers on row 4).',
    '',
    'Notes:',
    '• Leave employee amount blank to use Salary Structure default.',
    '• LOP Days drives the Loss of Pay deduction.',
    '• Upload this file (or your own copy) from Payslip Management to generate PDF payslips.',
  ]

  readmeLines.forEach((line, i) => {
    const r = readmeSheet.getRow(i + 2)
    const cell = r.getCell(1)
    cell.value = line
    if (line.startsWith('Sheet:')) {
      cell.font = { bold: true, size: 11, color: { argb: GREEN_DK } }
    } else if (line.startsWith('Notes:')) {
      cell.font = { bold: true, size: 11, color: { argb: GREEN_DK } }
    } else {
      cell.font = { size: 10, color: { argb: TEXT } }
    }
    cell.alignment = { wrapText: true, vertical: 'top' }
    r.height = line === '' ? 8 : 20
  })

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export const PAYROLL_TEMPLATE_FILENAME = 'payroll_master_template.xlsx'
