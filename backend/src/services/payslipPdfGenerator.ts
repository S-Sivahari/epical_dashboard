import PDFDocument from 'pdfkit'
import { createWriteStream } from 'fs'
import type { Company, SalaryStructure, Employee } from './payslipGenerator'
import { buildEarningsData, buildDeductionsData } from './payslipGenerator'

const PRIMARY = '#0E5E4E'
const PRIMARY_DK = '#0A4136'
const PRIMARY_LT = '#C9E4DC'
const MUTED = '#6B7280'
const BORDER = '#B7C9BC'

function formatAmount(v: unknown): string {
  try {
    const num = parseFloat(String(v))
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  } catch {
    return '0.00'
  }
}

function safe(v: unknown, defaultVal = ''): string {
  return v === null || v === undefined ? defaultVal : String(v)
}

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

// Re-export helpers from payslipGenerator (need to export buildEarningsData/buildDeductionsData)
// We'll duplicate minimal logic inline by importing - but they're not exported yet.

function drawSectionBar(doc: InstanceType<typeof PDFDocument>, text: string, y: number): number {
  doc
    .rect(40, y, 515, 22)
    .fill(PRIMARY)
  doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold').text(text, 48, y + 6, { width: 500 })
  doc.fillColor('#000000')
  return y + 30
}

function drawLabelValueRow(
  doc: InstanceType<typeof PDFDocument>,
  items: { label: string; value: string }[],
  y: number,
  colWidth: number
): number {
  let x = 40
  for (const item of items) {
    doc.rect(x, y, colWidth, 36).stroke(BORDER)
    doc
      .fontSize(8)
      .fillColor(PRIMARY_DK)
      .font('Helvetica-Bold')
      .text(item.label, x + 6, y + 6, { width: colWidth - 12 })
    doc.fontSize(9).fillColor('#000000').font('Helvetica').text(item.value, x + 6, y + 18, {
      width: colWidth - 12,
    })
    x += colWidth
  }
  return y + 40
}

export async function savePayslipAsPdf(
  company: Company,
  structure: SalaryStructure,
  emp: Employee,
  outputPath: string
): Promise<void> {
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

  const { earnings, gross } = buildEarningsData(emp, structure)
  const { deductions, totalDed } = buildDeductionsData(emp, structure)
  const netPay = gross - totalDed
  const paidDays = emp['Paid Days'] || company['Working Days']
  const lopDays = emp['LOP Days'] || 0

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 })
    const stream = createWriteStream(outputPath)
    doc.pipe(stream)

    doc.fontSize(16).fillColor(PRIMARY_DK).font('Helvetica-Bold').text(companyName, { align: 'left' })
    doc
      .moveTo(40, doc.y + 4)
      .lineTo(555, doc.y + 4)
      .strokeColor(PRIMARY)
      .lineWidth(2)
      .stroke()
    doc.moveDown(0.3)
    doc
      .fontSize(8)
      .fillColor(MUTED)
      .font('Helvetica')
      .text(
        `CIN: ${safe(company['CIN'])}    GSTIN: ${safe(company['GSTIN'])}    PAN: ${safe(company['Company PAN'])}`
      )
    doc.fontSize(8).fillColor(MUTED).font('Helvetica-Oblique').text(addr)
    doc.moveDown(0.5)

    const titleY = doc.y
    doc.rect(40, titleY, 515, 28).fill(PRIMARY)
    doc
      .fillColor('#FFFFFF')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(`PAYSLIP for the Pay Period of ${String(payMonth).toUpperCase()}`, 40, titleY + 8, {
        width: 515,
        align: 'center',
      })
    doc.fillColor('#000000')
    doc.y = titleY + 36

    const barY = doc.y
    const barW = 515 / 4
    const quickItems = [
      { label: 'PAY DATE', value: safe(payDate) },
      { label: 'WORKING DAYS', value: safe(company['Working Days']) },
      { label: 'LOP DAYS', value: safe(lopDays) },
      { label: 'PAID DAYS', value: safe(paidDays) },
    ]
    quickItems.forEach((item, i) => {
      const x = 40 + i * barW
      doc.rect(x, barY, barW, 40).fill(PRIMARY_LT).stroke(BORDER)
      doc.fontSize(7).fillColor(MUTED).font('Helvetica-Bold').text(item.label, x, barY + 6, {
        width: barW,
        align: 'center',
      })
      doc.fontSize(11).fillColor(PRIMARY_DK).text(item.value, x, barY + 20, { width: barW, align: 'center' })
    })
    doc.y = barY + 48

    let y = drawSectionBar(doc, 'EMPLOYEE INFORMATION', doc.y)
    y = drawLabelValueRow(
      doc,
      [
        { label: 'Emp ID', value: safe(emp['Emp ID']) },
        { label: 'Designation', value: safe(emp['Designation']) },
        { label: 'Location', value: safe(emp['Location']) },
      ],
      y,
      515 / 3
    )
    y = drawLabelValueRow(
      doc,
      [
        { label: 'Name', value: safe(emp['Name']) },
        { label: 'Department', value: safe(emp['Department']) },
        { label: 'Branch', value: safe(emp['Branch']) },
      ],
      y,
      515 / 3
    )
    y = drawLabelValueRow(
      doc,
      [
        { label: 'Date of Birth', value: safe(emp['Date of Birth']) },
        { label: 'Grade / Band', value: safe(emp['Grade']) },
        { label: 'Cost Centre', value: safe(emp['Cost Centre']) },
      ],
      y,
      515 / 3
    )
    y = drawLabelValueRow(
      doc,
      [
        { label: 'Date of Joining', value: safe(emp['Date of Joining']) },
        { label: 'Reporting To', value: safe(emp['Reporting To']) },
        { label: 'Employment Type', value: safe(emp['Employment Type']) },
      ],
      y,
      515 / 3
    )
    doc.y = y + 8

    y = drawSectionBar(doc, 'EARNINGS & DEDUCTIONS', doc.y)
    const tableTop = y
    const halfW = 257
    doc.rect(40, tableTop, halfW, 18).fill(PRIMARY)
    doc.rect(40 + halfW, tableTop, halfW + 1, 18).fill(PRIMARY)
    doc.fillColor('#FFFFFF').fontSize(9).text('EARNINGS', 40, tableTop + 5, { width: halfW, align: 'center' })
    doc.text('DEDUCTIONS', 40 + halfW, tableTop + 5, { width: halfW, align: 'center' })
    doc.fillColor('#000000')

    let rowY = tableTop + 18
    const maxRows = Math.max(earnings.length, deductions.length)
    for (let i = 0; i < maxRows; i++) {
      const fill = i % 2 === 0 ? '#F4F9F6' : '#FFFFFF'
      doc.rect(40, rowY, halfW, 28).fill(fill).stroke(BORDER)
      doc.rect(40 + halfW, rowY, halfW + 1, 28).fill(fill).stroke(BORDER)
      const e = earnings[i]
      const d = deductions[i]
      if (e) {
        doc.fontSize(8).font('Helvetica').text(e.name, 48, rowY + 4, { width: halfW - 80 })
        doc.font('Helvetica-Bold').text(`Rs. ${formatAmount(e.amount)}`, 48, rowY + 14, {
          width: halfW - 16,
          align: 'right',
        })
      }
      if (d) {
        doc.fontSize(8).font('Helvetica').text(d.name, 48 + halfW, rowY + 4, { width: halfW - 80 })
        doc.font('Helvetica-Bold').text(`Rs. ${formatAmount(d.amount)}`, 48 + halfW, rowY + 14, {
          width: halfW - 16,
          align: 'right',
        })
      }
      rowY += 28
    }

    doc.rect(40, rowY, halfW, 28).fill(PRIMARY_LT).stroke(BORDER)
    doc.rect(40 + halfW, rowY, halfW + 1, 28).fill(PRIMARY_LT).stroke(BORDER)
    doc.fontSize(9).font('Helvetica-Bold').text('GROSS EARNINGS', 48, rowY + 4)
    doc.text(`Rs. ${formatAmount(gross)}`, 48, rowY + 14, { width: halfW - 16, align: 'right' })
    doc.text('TOTAL DEDUCTIONS', 48 + halfW, rowY + 4)
    doc.text(`Rs. ${formatAmount(totalDed)}`, 48 + halfW, rowY + 14, {
      width: halfW - 16,
      align: 'right',
    })
    doc.y = rowY + 36

    doc.rect(40, doc.y, 515, 32).fill(PRIMARY_LT)
    doc
      .fontSize(14)
      .fillColor(PRIMARY_DK)
      .font('Helvetica-Bold')
      .text(`NET PAY: Rs. ${formatAmount(netPay)}`, 40, doc.y + 8, { width: 515, align: 'center' })
    doc.y += 36
    doc
      .fontSize(9)
      .fillColor(PRIMARY_DK)
      .font('Helvetica-Oblique')
      .text(`Amount in Words: Indian Rupees ${numToIndianWords(netPay)} Only`, { align: 'center' })
    doc.moveDown(1)
    doc
      .fontSize(7)
      .fillColor(MUTED)
      .font('Helvetica-Oblique')
      .text(
        'This is a computer-generated payslip and does not require a physical signature.',
        { align: 'center' }
      )

    doc.end()
    stream.on('finish', () => resolve())
    stream.on('error', reject)
  })
}
