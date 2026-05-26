// @ts-ignore
import PDFDocument from 'pdfkit'
import { createWriteStream, existsSync } from 'fs'
import { join } from 'path'
import {
  COMPANY_LOGO_BUNDLED,
  COMPANY_LOGO_PATH,
  PAYROLL_UPLOADS_ROOT,
  findProjectRootLogo,
} from '../config/paths'
import type { Company, SalaryStructure, Employee } from './payslipGenerator'
import { buildEarningsData, buildDeductionsData } from './payslipGenerator'

export type TemplateId = 'classic' | 'corporate' | 'minimal'

const A4_HEIGHT = 841.89
const A4_WIDTH = 595.28
const MARGIN = 40

const PAGE = {
  left: MARGIN,
  right: A4_WIDTH - MARGIN,
  width: A4_WIDTH - 2 * MARGIN,
  top: MARGIN,
  bottom: A4_HEIGHT - MARGIN,
  height: A4_HEIGHT,
}

/** Space reserved at page bottom: net pay bar + company footer block. */
const LAYOUT = {
  netPayH: 52,
  footerGap: 12,
  footerBlockH: 48,
  tableHeaderH: 22,
  tableEmptyRowsAfter: 2,
  totalsH: 24,
  minTableRowH: 13,
  maxTableRowH: 22,
  sectionHeaderH: 20,
  dataRowH: 24,
  dataRowHCompact: 21,
}

/** Typography scale (matches reference payslip — ~10–11pt body, larger titles). */
const FONTS = {
  companyName: 18,
  companyReg: 8.5,
  companyAddr: 8,
  titleBar: 12,
  summaryLabel: 8,
  summaryValue: 12,
  sectionHeader: 9,
  cellLabel: 9,
  cellValue: 10,
  tableHeader: 8.5,
  tableRowMin: 8,
  tableRowMid: 9,
  tableRowMax: 10,
  leaveHeader: 8,
  leaveNote: 7,
  leaveValue: 10,
  totals: 9,
  netPayLabel: 8,
  netPayWords: 9,
  netPayTitle: 13,
  netPaySub: 8,
  netPayAmount: 18,
  footerName: 9.5,
  footerContact: 8,
  footerDisclaimer: 7.5,
}

/** Footer text stacked upward from PAGE.bottom (tight line spacing). */
const FOOTER_TEXT = {
  padBottom: 4,
  lineGap: 4,
  disclaimerSize: FONTS.footerDisclaimer,
  contactSize: FONTS.footerContact,
  nameSize: FONTS.footerName,
  ruleGapAboveName: 5,
}

function bottomReservedHeight(): number {
  return LAYOUT.netPayH + LAYOUT.footerGap + LAYOUT.footerBlockH
}

/** Y below which body content must not draw (net pay + footer band). */
function contentZoneTop(): number {
  return PAGE.bottom - bottomReservedHeight() - 6
}

function netPayY(): number {
  return PAGE.bottom - LAYOUT.footerBlockH - LAYOUT.footerGap - LAYOUT.netPayH
}

/** Company footer — stacked from page bottom up; never uses doc.y (table cursor). */
function drawCompanyFooter(
  doc: InstanceType<typeof PDFDocument>,
  companyName: string,
  addressLine: string,
  email: string
): void {
  const b = PAGE.bottom
  const g = FOOTER_TEXT.lineGap

  let y = b - FOOTER_TEXT.padBottom - FOOTER_TEXT.disclaimerSize
  doc
    .fontSize(FOOTER_TEXT.disclaimerSize)
    .fillColor('#9CA3AF')
    .font('Helvetica-Oblique')
    .text(
      'This is a computer-generated payslip and does not require a physical signature.',
      PAGE.left,
      y,
      { width: PAGE.width, align: 'center', lineBreak: false, lineGap: 0 }
    )

  y -= g + FOOTER_TEXT.contactSize
  const contactParts = [addressLine, email ? `Email: ${email}` : ''].filter(Boolean)
  const contactLine = contactParts.join('  |  ')
  doc
    .fontSize(FOOTER_TEXT.contactSize)
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .text(contactLine, PAGE.left, y, {
      width: PAGE.width,
      align: 'center',
      lineBreak: false,
      lineGap: 0,
      ellipsis: true,
    })

  y -= g + FOOTER_TEXT.nameSize
  doc
    .fontSize(FOOTER_TEXT.nameSize)
    .fillColor(COLORS.primaryDark)
    .font('Helvetica-Bold')
    .text(companyName, PAGE.left, y, { width: PAGE.width, align: 'center', lineBreak: false, lineGap: 0 })

  const ruleY = y - FOOTER_TEXT.ruleGapAboveName
  doc
    .strokeColor(COLORS.primary)
    .lineWidth(1.2)
    .moveTo(PAGE.left, ruleY)
    .lineTo(PAGE.right, ruleY)
    .stroke()
  doc.strokeColor(COLORS.borderLight)
}

/** Fit data + spacer rows in the band above totals and the fixed bottom block. */
function calcTableRowHeight(yTableStart: number, dataRowCount: number): number {
  const bodyRows = dataRowCount + LAYOUT.tableEmptyRowsAfter
  if (bodyRows <= 0) return LAYOUT.maxTableRowH
  const available =
    contentZoneTop() - yTableStart - LAYOUT.tableHeaderH - LAYOUT.totalsH
  if (available <= 0) return LAYOUT.minTableRowH
  const ideal = available / bodyRows
  return Math.max(LAYOUT.minTableRowH, Math.min(LAYOUT.maxTableRowH, ideal))
}

type SalaryTableRow = {
  earn?: { name: string; earned: number; ytd: number }
  ded?: { name: string; month: number; ytd: number }
}

/** One earnings/deductions grid row (data or empty spacer). */
function drawSalaryTableRow(
  doc: InstanceType<typeof PDFDocument>,
  y: number,
  rowH: number,
  rowIndex: number,
  rowFont: number,
  geom: {
    earnLeft: number
    earnW: number
    nameColEarn: number
    amtColEarn: number
    nameColDed: number
    amtColDed: number
  },
  row: SalaryTableRow
): void {
  const fill = rowIndex % 2 === 0 ? COLORS.rowAlt : COLORS.white
  const { earnLeft, earnW, nameColEarn, amtColEarn, nameColDed, amtColDed } = geom
  const dedLeft = earnLeft + earnW
  const cellOpts = { fontSize: rowFont, minFontSize: 5.5, color: COLORS.text }

  let rx = earnLeft
  const er = row.earn
  doc.rect(rx, y, nameColEarn, rowH).fill(fill).stroke(COLORS.borderLight)
  if (er) drawCellText(doc, er.name, rx, y, nameColEarn, rowH, cellOpts)
  rx += nameColEarn
  doc.rect(rx, y, amtColEarn, rowH).fill(fill).stroke(COLORS.borderLight)
  if (er) drawCellText(doc, formatAmount(er.earned), rx, y, amtColEarn, rowH, { ...cellOpts, align: 'right' })
  rx += amtColEarn
  doc.rect(rx, y, amtColEarn, rowH).fill(fill).stroke(COLORS.borderLight)
  if (er) drawCellText(doc, formatAmount(er.ytd), rx, y, amtColEarn, rowH, { ...cellOpts, align: 'right' })

  let dx = dedLeft
  const dr = row.ded
  doc.rect(dx, y, nameColDed, rowH).fill(fill).stroke(COLORS.borderLight)
  if (dr) drawCellText(doc, dr.name, dx, y, nameColDed, rowH, cellOpts)
  dx += nameColDed
  doc.rect(dx, y, amtColDed, rowH).fill(fill).stroke(COLORS.borderLight)
  if (dr) drawCellText(doc, formatAmount(dr.month), dx, y, amtColDed, rowH, { ...cellOpts, align: 'right' })
  dx += amtColDed
  doc.rect(dx, y, amtColDed, rowH).fill(fill).stroke(COLORS.borderLight)
  if (dr) drawCellText(doc, formatAmount(dr.ytd), dx, y, amtColDed, rowH, { ...cellOpts, align: 'right' })
}

/** Net pay bar — fixed reference typography (not table auto-shrink fonts). */
function drawBottomBand(
  doc: InstanceType<typeof PDFDocument>,
  netPay: number,
  companyName: string,
  addressLine: string,
  email: string,
  compactLayout: boolean
): void {
  const y = netPayY()
  const netLeftW = PAGE.width * 0.42
  const netMidW = PAGE.width * 0.28
  const netRightW = PAGE.width - netLeftW - netMidW
  const netH = LAYOUT.netPayH
  const wordsText = `Indian Rupees ${numToIndianWords(netPay)} Only`
  const amountText = `Rs. ${formatAmount(netPay)}`

  // ── Left: amount in words (grey label + green bold-italic) ─────────────────
  doc.rect(PAGE.left, y, netLeftW, netH).stroke(COLORS.borderLight)
  doc.save()
  doc.rect(PAGE.left, y, netLeftW, netH).clip()
  doc
    .fontSize(FONTS.netPayLabel)
    .fillColor(COLORS.muted)
    .font('Helvetica-Bold')
    .text('AMOUNT IN WORDS', PAGE.left + 8, y + 8, { width: netLeftW - 16, lineBreak: false })
  doc
    .fontSize(compactLayout ? 8 : FONTS.netPayWords)
    .fillColor(COLORS.primaryDark)
    .font('Helvetica-BoldOblique')
    .text(wordsText, PAGE.left + 8, y + 18, {
      width: netLeftW - 16,
      lineGap: 0,
    })
  doc.restore()

  // ── Middle: NET PAY (white bold + white italic subtitle) ───────────────────
  doc.rect(PAGE.left + netLeftW, y, netMidW, netH).fill(COLORS.primary)
  doc
    .fontSize(compactLayout ? 12 : FONTS.netPayTitle)
    .fillColor(COLORS.white)
    .font('Helvetica-Bold')
    .text('NET PAY', PAGE.left + netLeftW, y + 10, { width: netMidW, align: 'center', lineBreak: false })
  doc
    .fontSize(FONTS.netPaySub)
    .fillColor(COLORS.white)
    .font('Helvetica-Oblique')
    .text('(Take Home / In-hand)', PAGE.left + netLeftW, y + 28, {
      width: netMidW,
      align: 'center',
      lineBreak: false,
    })

  // ── Right: large green Rs. amount ───────────────────────────────────────────
  doc.rect(PAGE.left + netLeftW + netMidW, y, netRightW, netH).fill(COLORS.primaryLight).stroke(COLORS.border)
  const amtFs = compactLayout ? 16 : FONTS.netPayAmount
  const amtY = y + (netH - amtFs) / 2 - 2
  doc.save()
  doc.rect(PAGE.left + netLeftW + netMidW, y, netRightW, netH).clip()
  doc
    .fontSize(amtFs)
    .fillColor(COLORS.primaryDark)
    .font('Helvetica-Bold')
    .text(amountText, PAGE.left + netLeftW + netMidW, amtY, {
      width: netRightW,
      align: 'center',
      lineBreak: false,
    })
  doc.restore()

  doc.fillColor(COLORS.text)
  drawCompanyFooter(doc, companyName, addressLine, email)
}

function tableFontSize(rowH: number): number {
  const maxByHeight = Math.max(5.5, rowH - 4)
  let preferred = FONTS.tableRowMax
  if (rowH <= 14) preferred = FONTS.tableRowMin
  else if (rowH <= 17) preferred = FONTS.tableRowMid
  return Math.min(maxByHeight, preferred)
}

/** Fixed minimum width for amount columns so figures do not overlap. */
const SALARY_TABLE = {
  minAmtColW: 72,
  earnShare: 0.52,
  cellPadX: 5,
  cellPadY: 2,
}

function calcSalaryTableColumns(contentWidth: number) {
  const earnW = Math.floor(contentWidth * SALARY_TABLE.earnShare)
  const dedW = contentWidth - earnW
  const amtColEarn = SALARY_TABLE.minAmtColW
  const amtColDed = SALARY_TABLE.minAmtColW
  return {
    earnW,
    dedW,
    nameColEarn: earnW - amtColEarn * 2,
    amtColEarn,
    nameColDed: dedW - amtColDed * 2,
    amtColDed,
  }
}

function fitFontSize(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  maxWidth: number,
  preferred: number,
  min: number,
  fontName: string
): number {
  let fs = preferred
  doc.font(fontName)
  while (fs > min) {
    doc.fontSize(fs)
    if (doc.widthOfString(text) <= maxWidth) return fs
    fs -= 0.5
  }
  return min
}

/** Draw text inside a cell with clip + auto-shrink so it never bleeds into neighbors. */
function drawCellText(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: {
    fontSize: number
    minFontSize?: number
    align?: 'left' | 'right' | 'center'
    color?: string
    bold?: boolean
  }
): void {
  if (!text) return
  const padX = SALARY_TABLE.cellPadX
  const padY = SALARY_TABLE.cellPadY
  const innerW = Math.max(1, w - padX * 2)
  const innerH = Math.max(1, h - padY * 2)
  const fontName = opts.bold ? 'Helvetica-Bold' : 'Helvetica'
  const minFs = opts.minFontSize ?? 5.5
  let fs = fitFontSize(doc, text, innerW, opts.fontSize, minFs, fontName)
  fs = Math.min(fs, Math.max(minFs, innerH - 2))

  doc.save()
  doc.rect(x, y, w, h).clip()
  doc.fillColor(opts.color ?? COLORS.text).font(fontName).fontSize(fs)
  const textY = y + padY + Math.max(0, (innerH - fs) / 2) - 1
  doc.text(text, x + padX, textY, {
    width: innerW,
    align: opts.align ?? 'left',
    lineBreak: false,
    ellipsis: true,
  })
  doc.restore()
}

const COLORS = {
  primary: '#0E5E4E',
  primaryDark: '#0A4136',
  primaryLight: '#D1E7DD',
  labelBg: '#EAF3EE',
  border: '#B7C9BC',
  borderLight: '#CCCCCC',
  muted: '#6B7280',
  text: '#1F2937',
  white: '#FFFFFF',
  rowAlt: '#F4F9F6',
}

function formatAmount(v: unknown): string {
  try {
    const num = parseFloat(String(v))
    if (Number.isNaN(num)) return '0.00'
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  } catch {
    return '0.00'
  }
}

function safe(v: unknown, defaultVal = ''): string {
  if (v === null || v === undefined) return defaultVal
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const day = String(v.getUTCDate()).padStart(2, '0')
    return `${day}-${months[v.getUTCMonth()]}-${v.getUTCFullYear()}`
  }
  return String(v)
}

function parseAmount(v: unknown): number {
  try {
    const n = parseFloat(String(v))
    return Number.isNaN(n) ? 0 : n
  } catch {
    return 0
  }
}

function numToIndianWords(n: number): string {
  n = Math.round(n)
  if (n === 0) return 'Zero'
  const units = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ]
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

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

function getYtdAmount(emp: Employee, empCol: string, earned: number): number {
  const ytdMap = emp['_componentYtd'] as Record<string, number> | undefined
  if (ytdMap && empCol in ytdMap) {
    return ytdMap[empCol]
  }
  for (const key of [`${empCol} YTD`, `YTD ${empCol}`, `${empCol} Ytd`]) {
    if (emp[key] !== undefined && emp[key] !== '') {
      return parseAmount(emp[key])
    }
  }
  return earned
}

function drawFilledBar(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  text: string,
  opts?: { fontSize?: number; align?: 'left' | 'center' }
): number {
  doc.rect(x, y, w, h).fill(fill)
  doc
    .fillColor(COLORS.white)
    .fontSize(opts?.fontSize ?? FONTS.titleBar)
    .font('Helvetica-Bold')
    .text(text, x + 6, y + (h - (opts?.fontSize ?? FONTS.titleBar)) / 2 - 1, {
      width: w - 12,
      align: opts?.align ?? 'center',
    })
  doc.fillColor(COLORS.text)
  return y + h
}

function drawLabelValueCell(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  labelW: number
): void {
  doc.rect(x, y, w, h).stroke(COLORS.borderLight)
  doc.rect(x, y, labelW, h).fill(COLORS.labelBg).stroke(COLORS.borderLight)
  drawCellText(doc, label, x, y, labelW, h, {
    fontSize: FONTS.cellLabel,
    minFontSize: 6,
    color: COLORS.primaryDark,
    bold: true,
  })
  drawCellText(doc, value, x + labelW, y, w - labelW, h, {
    fontSize: FONTS.cellValue,
    minFontSize: 6,
    color: COLORS.text,
  })
}

/** Mask account number — show last 4 digits only (e.g. XXXXXXXX5678). */
function maskAccountNumber(value: unknown): string {
  const raw = safe(value).replace(/\s/g, '')
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length <= 4) return raw
  const maskLen = Math.min(Math.max(digits.length - 4, 4), 10)
  return `${'X'.repeat(maskLen)}${digits.slice(-4)}`
}

function formatIfscAndMode(emp: Employee): string {
  const ifscOnly = safe(emp['IFSC'])
  const payMode = safe(emp['Payment Mode'], safe(emp['Pay Mode'], 'NEFT'))
  const combined = safe(emp['IFSC / Mode'])
  if (ifscOnly) {
    return payMode ? `${ifscOnly}\n${payMode}` : ifscOnly
  }
  if (!combined) return payMode
  const parts = combined.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]}\n${parts.slice(1).join(' ')}`
  }
  return combined
}

export function resolveLogoPath(company: Company = {}): string | null {
  const rootLogo = findProjectRootLogo()
  const candidates = [
    company['Logo Path'],
    company['Logo'],
    rootLogo,
    join(PAYROLL_UPLOADS_ROOT, 'template', 'company_logo.jpeg'),
    join(PAYROLL_UPLOADS_ROOT, 'template', 'company_logo.jpg'),
    COMPANY_LOGO_PATH,
    join(PAYROLL_UPLOADS_ROOT, 'template', 'company_logo.webp'),
    COMPANY_LOGO_BUNDLED,
  ]
  for (const c of candidates) {
    const p = safe(c).trim()
    if (p && existsSync(p)) return p
  }
  return null
}

export async function savePayslipAsPdf(
  company: Company,
  structure: SalaryStructure,
  emp: Employee,
  outputPath: string,
  _templateId: TemplateId = 'classic'
): Promise<void> {
  const payMonth = safe(company['Pay Month'])
  const payDate = safe(company['Pay Date'])
  const companyName = safe(company['Company Name'], 'Epical Layouts Pvt Ltd')
  const addrParts = [
    company['Address Line 1'],
    company['Address Line 2'],
    company['City'],
    company['State'],
    company['PIN'],
  ]
    .map((p) => safe(p))
    .filter(Boolean)
  const addr = addrParts.join(addrParts.length > 2 ? ' ' : ', ')

  const { earnings, gross } = buildEarningsData(emp, structure)
  const { deductions, totalDed } = buildDeductionsData(emp, structure)
  const lopDays = parseAmount(emp['LOP Days'])
  const workingDays = parseAmount(company['Working Days']) || 26
  const paidDays = parseAmount(emp['Paid Days']) || workingDays - lopDays

  const lopAmount =
    parseAmount(emp['Loss of Pay']) ||
    (lopDays > 0 && gross > 0 && paidDays > 0
      ? Math.round((gross / paidDays) * lopDays * 100) / 100
      : parseAmount(structure['Loss of Pay']?.default))

  const allDeductions = [...deductions.filter((d) => d.name !== 'Loss of Pay')]
  if (lopAmount > 0 || lopDays > 0) {
    allDeductions.push({ name: 'Loss of Pay', amount: lopAmount })
  }
  const totalDedWithLop = allDeductions.reduce((s, d) => s + d.amount, 0)
  const netPay = gross - totalDedWithLop

  const earningRows = earnings.map((e) => ({
    name: e.name,
    earned: e.amount,
    ytd: getYtdAmount(emp, e.name, e.amount),
  }))
  const grossYtd = earningRows.reduce((s, r) => s + r.ytd, 0)

  const deductionRows = allDeductions.map((d) => ({
    name: d.name,
    month: d.amount,
    ytd: getYtdAmount(emp, d.name, d.amount),
  }))
  const totalDedYtd = deductionRows.reduce((s, r) => s + r.ytd, 0)

  const maxRows = Math.max(earningRows.length, deductionRows.length)
  const compactLayout = maxRows > 10

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN })
    const stream = createWriteStream(outputPath)
    doc.pipe(stream)

    let y = PAGE.top

    // ── Header: logo + company ─────────────────────────────────────────────
    const logoPath = resolveLogoPath(company)
    const logoW = 96
    const logoH = 68
    if (logoPath) {
      try {
        doc.image(logoPath, PAGE.left, y, { fit: [logoW, logoH], align: 'center', valign: 'center' })
      } catch {
        doc.rect(PAGE.left, y, logoW, logoH).stroke(COLORS.borderLight)
        doc.fontSize(8).fillColor(COLORS.muted).text('[ LOGO ]', PAGE.left, y + 26, {
          width: logoW,
          align: 'center',
        })
      }
    } else {
      doc.rect(PAGE.left, y, logoW, logoH).stroke(COLORS.borderLight)
      doc.fontSize(8).fillColor(COLORS.muted).text('[ LOGO ]', PAGE.left, y + 26, {
        width: logoW,
        align: 'center',
      })
    }

    const coX = PAGE.left + logoW + 12
    const coW = PAGE.width - logoW - 12
    doc
      .fontSize(FONTS.companyName)
      .fillColor(COLORS.primaryDark)
      .font('Helvetica-Bold')
      .text(companyName, coX, y, { width: coW })
    y = doc.y + 2
    doc
      .fontSize(FONTS.companyReg)
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .text(
        `CIN: ${safe(company['CIN'])}    GSTIN: ${safe(company['GSTIN'])}    PAN: ${safe(company['Company PAN'])}`,
        coX,
        y,
        { width: coW }
      )
    y = doc.y + 2
    doc.fontSize(FONTS.companyAddr).font('Helvetica').text(addr, coX, y, { width: coW })
    y = Math.max(y + 28, 40 + logoH) + 10

    // ── Title bar ───────────────────────────────────────────────────────────
    y = drawFilledBar(
      doc,
      PAGE.left,
      y,
      PAGE.width,
      26,
      COLORS.primary,
      `PAYSLIP for the Pay Period of ${payMonth.toUpperCase()}`,
      { fontSize: FONTS.titleBar }
    ) + 4

    // ── Pay summary bar ───────────────────────────────────────────────────────
    const barH = 40
    const barColW = PAGE.width / 4
    const summaryItems = [
      { label: 'PAY DATE', value: payDate },
      { label: 'WORKING DAYS', value: safe(company['Working Days']) },
      { label: 'LOP DAYS', value: safe(lopDays) },
      { label: 'PAID DAYS', value: safe(paidDays) },
    ]
    summaryItems.forEach((item, i) => {
      const x = PAGE.left + i * barColW
      doc.rect(x, y, barColW, barH).fill(COLORS.primaryLight).stroke(COLORS.border)
      doc
        .fontSize(FONTS.summaryLabel)
        .fillColor(COLORS.muted)
        .font('Helvetica-Bold')
        .text(item.label, x, y + 6, { width: barColW, align: 'center' })
      doc
        .fontSize(FONTS.summaryValue)
        .fillColor(COLORS.primaryDark)
        .font('Helvetica-Bold')
        .text(item.value, x, y + 20, { width: barColW, align: 'center' })
    })
    y += barH + (compactLayout ? 6 : 8)

    // ── Employee / Role / Location (3 columns) ────────────────────────────────
    const col3W = PAGE.width / 3
    const sectionTitles = ['EMPLOYEE INFORMATION', 'ROLE & ASSIGNMENT', 'LOCATION & STATUS']
    const secH = LAYOUT.sectionHeaderH
    sectionTitles.forEach((title, i) => {
      doc.rect(PAGE.left + i * col3W, y, col3W, secH).fill(COLORS.primary)
      doc
        .fillColor(COLORS.white)
        .fontSize(FONTS.sectionHeader)
        .font('Helvetica-Bold')
        .text(title, PAGE.left + i * col3W + 4, y + (secH - FONTS.sectionHeader) / 2 - 1, {
          width: col3W - 8,
          align: 'center',
        })
    })
    doc.fillColor(COLORS.text)
    y += secH

    const empBlocks = [
      [
        { label: 'Emp ID', value: safe(emp['Emp ID']) },
        { label: 'Name', value: safe(emp['Name']) },
        { label: 'Date of Birth', value: safe(emp['Date of Birth']) },
        { label: 'Date of Joining', value: safe(emp['Date of Joining']) },
      ],
      [
        { label: 'Designation', value: safe(emp['Designation']) },
        { label: 'Department', value: safe(emp['Department']) },
        { label: 'Grade / Band', value: safe(emp['Grade']) },
        { label: 'Reporting To', value: safe(emp['Reporting To']) },
      ],
      [
        { label: 'Location', value: safe(emp['Location']) },
        { label: 'Branch', value: safe(emp['Branch']) },
        { label: 'Cost Centre', value: safe(emp['Cost Centre']) },
        { label: 'Employment Type', value: safe(emp['Employment Type']) },
      ],
    ]

    const empRowH = compactLayout ? LAYOUT.dataRowHCompact : LAYOUT.dataRowH
    const labelW = 68
    for (let r = 0; r < 4; r++) {
      empBlocks.forEach((block, c) => {
        const x = PAGE.left + c * col3W
        const item = block[r]
        drawLabelValueCell(doc, x, y, col3W, empRowH, item.label, item.value, labelW)
      })
      y += empRowH
    }
    y += compactLayout ? 4 : 6

    // ── Statutory + Bank ──────────────────────────────────────────────────────
    const halfW = PAGE.width / 2
    doc.rect(PAGE.left, y, halfW, secH).fill(COLORS.primary)
    doc.rect(PAGE.left + halfW, y, halfW, secH).fill(COLORS.primary)
    doc.fillColor(COLORS.white).fontSize(FONTS.sectionHeader).font('Helvetica-Bold')
    doc.text('STATUTORY IDENTIFIERS', PAGE.left, y + (secH - FONTS.sectionHeader) / 2 - 1, {
      width: halfW,
      align: 'center',
    })
    doc.text('BANK & PAYMENT', PAGE.left + halfW, y + (secH - FONTS.sectionHeader) / 2 - 1, {
      width: halfW,
      align: 'center',
    })
    doc.fillColor(COLORS.text)
    y += secH

    const taxRegime = safe(emp['Tax Regime'], safe(company['Default Tax Regime'], 'New'))
    const pan = safe(emp['PAN'])
    const aadhaar = safe(emp['Aadhaar'], safe(emp['Aadhaar (last 4)']))
    const acNo = maskAccountNumber(safe(emp['A/C No'], safe(emp['Account Number'])))
    const bank = safe(emp['Bank'], safe(emp['Bank Name']))
    const ifscMode = formatIfscAndMode(emp)

    const statPairW = halfW / 2
    const statLabelW = 64
    const bankLabelW = 84
    const gridRowH = compactLayout ? LAYOUT.dataRowHCompact : LAYOUT.dataRowH
    const bankIfscRowH = ifscMode.includes('\n') ? (compactLayout ? 26 : 30) : gridRowH

    // Row 1: PAN + Aadhaar | Bank
    drawLabelValueCell(doc, PAGE.left, y, statPairW, gridRowH, 'PAN', pan, statLabelW)
    drawLabelValueCell(
      doc,
      PAGE.left + statPairW,
      y,
      statPairW,
      gridRowH,
      'Aadhaar (last 4)',
      aadhaar,
      statLabelW
    )
    drawLabelValueCell(doc, PAGE.left + halfW, y, halfW, gridRowH, 'Bank', bank, bankLabelW)

    // Row 2: Tax Regime + A/C No. | IFSC / Mode
    const y2 = y + gridRowH
    drawLabelValueCell(doc, PAGE.left, y2, statPairW, bankIfscRowH, 'Tax Regime', taxRegime, statLabelW)
    drawLabelValueCell(doc, PAGE.left + statPairW, y2, statPairW, bankIfscRowH, 'A/C No.', acNo, statLabelW)
    drawLabelValueCell(
      doc,
      PAGE.left + halfW,
      y2,
      halfW,
      bankIfscRowH,
      'IFSC / Mode',
      ifscMode,
      bankLabelW
    )

    y += gridRowH + bankIfscRowH + 6

    // ── Leave balance ─────────────────────────────────────────────────────────
    const leaveCols = [
      { title: 'LEAVE BALANCE', w: PAGE.width * 0.28 },
      { title: 'EARNED LEAVE (EL)', w: PAGE.width * 0.18 },
      { title: 'CASUAL LEAVE (CL)', w: PAGE.width * 0.18 },
      { title: 'SICK LEAVE (SL)', w: PAGE.width * 0.18 },
      { title: 'COMP OFF', w: PAGE.width * 0.18 },
    ]
    let lx = PAGE.left
    leaveCols.forEach((col) => {
      doc.rect(lx, y, col.w, secH).fill(COLORS.primary)
      doc
        .fillColor(COLORS.white)
        .fontSize(FONTS.leaveHeader)
        .font('Helvetica-Bold')
        .text(col.title, lx + 2, y + (secH - FONTS.leaveHeader) / 2 - 1, {
          width: col.w - 4,
          align: 'center',
        })
      lx += col.w
    })
    doc.fillColor(COLORS.text)
    y += secH

    const leaveValues = [
      '*Available as on month-end*',
      safe(emp['EL Balance'], safe(emp['Earned Leave'], '0')),
      safe(emp['CL Balance'], safe(emp['Casual Leave'], '0')),
      safe(emp['SL Balance'], safe(emp['Sick Leave'], '0')),
      safe(emp['Comp Off'], safe(emp['COMP OFF'], '0')),
    ]
    lx = PAGE.left
    const leaveValH = compactLayout ? 24 : 26
    leaveCols.forEach((col, i) => {
      doc.rect(lx, y, col.w, leaveValH).fill(COLORS.primaryLight).stroke(COLORS.border)
      const fs = i === 0 ? FONTS.leaveNote : FONTS.leaveValue
      doc
        .fontSize(fs)
        .font(i === 0 ? 'Helvetica-Oblique' : 'Helvetica-Bold')
        .fillColor(i === 0 ? COLORS.muted : COLORS.primaryDark)
        .text(leaveValues[i], lx + 2, y + (leaveValH - fs) / 2 - 1, { width: col.w - 4, align: 'center' })
      lx += col.w
    })
    y += leaveValH + (compactLayout ? 4 : 6)

    // ── Earnings & Deductions (no Rate column) ───────────────────────────────
    const cols = calcSalaryTableColumns(PAGE.width)
    const { earnW, dedW, nameColEarn, amtColEarn, nameColDed, amtColDed } = cols
    const tableGeom = {
      earnLeft: PAGE.left,
      earnW,
      nameColEarn,
      amtColEarn,
      nameColDed,
      amtColDed,
    }

    const drawTableHeader = (baseX: number, headers: { text: string; w: number }[]) => {
      let hx = baseX
      headers.forEach((h) => {
        doc.rect(hx, y, h.w, LAYOUT.tableHeaderH).fill(COLORS.primary)
        drawCellText(doc, h.text, hx, y, h.w, LAYOUT.tableHeaderH, {
          fontSize: FONTS.tableHeader,
          minFontSize: 5.5,
          align: 'center',
          color: COLORS.white,
          bold: true,
        })
        hx += h.w
      })
      doc.fillColor(COLORS.text)
    }

    const yTableStart = y
    drawTableHeader(PAGE.left, [
      { text: 'EARNINGS', w: nameColEarn },
      { text: 'Earned (Rs)', w: amtColEarn },
      { text: 'YTD (Rs)', w: amtColEarn },
    ])
    drawTableHeader(PAGE.left + earnW, [
      { text: 'DEDUCTIONS', w: nameColDed },
      { text: 'This Month (Rs)', w: amtColDed },
      { text: 'YTD (Rs)', w: amtColDed },
    ])
    y += LAYOUT.tableHeaderH

    const tableRowH = calcTableRowHeight(yTableStart, maxRows)
    const rowFont = tableFontSize(tableRowH)
    const tableBottomLimit = contentZoneTop()

    for (let i = 0; i < maxRows; i++) {
      if (y + tableRowH > tableBottomLimit) break
      const er = earningRows[i]
      const dr = deductionRows[i]
      drawSalaryTableRow(
        doc,
        y,
        tableRowH,
        i,
        rowFont,
        tableGeom,
        er ? { earn: er, ded: dr } : { ded: dr }
      )
      y += tableRowH
    }

    for (let e = 0; e < LAYOUT.tableEmptyRowsAfter; e++) {
      if (y + tableRowH > tableBottomLimit) break
      drawSalaryTableRow(doc, y, tableRowH, maxRows + e, rowFont, tableGeom, {})
      y += tableRowH
    }

    // Totals row (only if it fits above the fixed bottom band)
    const totalsRowH = compactLayout ? LAYOUT.totalsH - 2 : LAYOUT.totalsH
    const totalsCell = {
      fontSize: FONTS.totals,
      minFontSize: 6,
      color: COLORS.primaryDark,
      bold: true,
    }
    if (y + totalsRowH <= tableBottomLimit) {
      let rx = PAGE.left
      doc.rect(rx, y, nameColEarn, totalsRowH).fill(COLORS.primaryLight).stroke(COLORS.border)
      drawCellText(doc, 'GROSS EARNINGS', rx, y, nameColEarn, totalsRowH, totalsCell)
      rx += nameColEarn
      doc.rect(rx, y, amtColEarn, totalsRowH).fill(COLORS.primaryLight).stroke(COLORS.border)
      drawCellText(doc, formatAmount(gross), rx, y, amtColEarn, totalsRowH, { ...totalsCell, align: 'right' })
      rx += amtColEarn
      doc.rect(rx, y, amtColEarn, totalsRowH).fill(COLORS.primaryLight).stroke(COLORS.border)
      drawCellText(doc, formatAmount(grossYtd), rx, y, amtColEarn, totalsRowH, { ...totalsCell, align: 'right' })

      let dx = PAGE.left + earnW
      doc.rect(dx, y, nameColDed, totalsRowH).fill(COLORS.primaryLight).stroke(COLORS.border)
      drawCellText(doc, 'TOTAL DEDUCTIONS', dx, y, nameColDed, totalsRowH, totalsCell)
      dx += nameColDed
      doc.rect(dx, y, amtColDed, totalsRowH).fill(COLORS.primaryLight).stroke(COLORS.border)
      drawCellText(doc, formatAmount(totalDedWithLop), dx, y, amtColDed, totalsRowH, {
        ...totalsCell,
        align: 'right',
      })
      dx += amtColDed
      doc.rect(dx, y, amtColDed, totalsRowH).fill(COLORS.primaryLight).stroke(COLORS.border)
      drawCellText(doc, formatAmount(totalDedYtd), dx, y, amtColDed, totalsRowH, {
        ...totalsCell,
        align: 'right',
      })
    }

    // Net pay + footer: fixed to page bottom (not after table / last column)
    drawBottomBand(doc, netPay, companyName, addr, safe(company['Email']), compactLayout)

    doc.end()
    stream.on('finish', () => resolve())
    stream.on('error', reject)
  })
}
