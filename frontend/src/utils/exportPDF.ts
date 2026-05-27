import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { employeeToExportRow } from '@/constants/employeeExport'
import type { Employee } from '@/types'
<<<<<<< HEAD
import { fetchExportLogo, scaleExportLogo, EXPORT_LOGO_PATH } from '@/utils/exportLogo'
=======
import { PDF_LOGO_MAX_WIDTH, drawPdfLogoLeft, fetchExportLogo, scaleExportLogo } from '@/utils/exportLogo'
>>>>>>> 13af5beca1171715405cd0431c6942cb53bc0d0f

const BRAND_GREEN: [number, number, number] = [16, 185, 129]

/** Draw "EPICAL …" with IC in brand green; returns total rendered width. */
function drawEpicalBrandedText(
  doc: jsPDF,
  parts: { before: string; after: string },
  x: number,
  y: number,
  align: 'left' | 'center' = 'center',
  pageWidth = doc.internal.pageSize.width || 842,
  fontStyle: 'normal' | 'bold' = 'bold',
): number {
  doc.setFont('helvetica', fontStyle)
  const segments = [
    { text: parts.before, color: [0, 0, 0] as [number, number, number] },
    { text: 'IC', color: BRAND_GREEN },
    { text: parts.after, color: [0, 0, 0] as [number, number, number] },
  ]
  const totalWidth = segments.reduce((sum, seg) => sum + doc.getTextWidth(seg.text), 0)
  let cursorX = align === 'center' ? pageWidth / 2 - totalWidth / 2 : x

  for (const seg of segments) {
    doc.setTextColor(...seg.color)
    doc.text(seg.text, cursorX, y)
    cursorX += doc.getTextWidth(seg.text)
  }
  return totalWidth
}

export async function exportAnalyticsPdf(filename: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' })
  const pageWidth = doc.internal.pageSize.width || 842

  let y = 40
  doc.setFontSize(16)
  doc.setTextColor(0, 0, 0)
  doc.text('Analytics Report', pageWidth / 2, y, { align: 'center' })
  y += 20
  doc.setFontSize(10)
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, y, { align: 'center' })
  doc.save(filename)
}

export interface ExportPdfOptions {
  generatedBy?: string
  filters?: Record<string, string | undefined>
  compactMode?: boolean
  employeeDetailMode?: boolean
  /** Employee exports: logo top-left, omit panel subtitle / [ PDF Document ]. */
  employeePdfStyle?: boolean
  /** With employeePdfStyle + logo: centered row of logo beside company/report titles. */
  headerLogoAdjacentToTitle?: boolean
  panelTitle?: string
  reportTitle?: string
}

function formatDateStr(d: string | Date | undefined | null): string {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return String(d)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${String(date.getDate()).padStart(2, '0')}-${months[date.getMonth()]}-${date.getFullYear()}`
}

function buildIndividualDetailFields(e: Record<string, any>): [string, string][] {
  const row = employeeToExportRow(e as Employee)
  const fullName = [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ')
  return [
    ['FULL NAME', fullName || '—'],
    ['EMPLOYEE ID', String(e.employeeId ?? '—')],
    ['STATUS', String(e.status ?? '—')],
    ['COMPANY EMAIL', String(e.email ?? '—')],
    ['PERSONAL EMAIL', String(e.personalEmail ?? '—')],
    ['PHONE', String(e.phone ?? '—')],
    ['DATE OF BIRTH', formatDateStr(e.dob)],
    ['GENDER', String(e.gender ?? '—')],
    ['PERMANENT ADDRESS', String(row.permanentAddress ?? '—')],
    ['COMMUNICATION ADDRESS', String(row.communicationAddress ?? '—')],
    ['ROLE', String(e.role ?? '—')],
    ['DEPARTMENT', String(e.department ?? '—')],
    ['DESIGNATION', String(e.designation ?? '—')],
    ['EMPLOYMENT TYPE', String(e.employmentType ?? '—')],
    ['JOINED AT', formatDateStr(e.joinedAt)],
    ['REPORTING MANAGER', String(e.reportingManager ?? '—')],
    [
      'CTC (ANNUAL)',
      e.ctc ? `INR ${Number(e.ctc).toLocaleString('en-IN')}` : '—',
    ],
    ['BANK NAME', String(e.bankName ?? '—')],
    ['ACCOUNT NO', String(e.accountNumber ?? '—')],
    ['IFSC CODE', String(e.ifsc ?? '—')],
    ['UAN NUMBER', String(e.uan ?? '—')],
    [
      'PF / ESI',
      e.pfEsi === 'on' ? 'Enabled' : e.pfEsi === 'off' ? 'Disabled' : '—',
    ],
    ['AADHAAR NUMBER', String(e.aadhaar ?? '—')],
    ['PAN', String(e.pan ?? '—')],
    ['PASSPORT NUMBER', String(e.passport ?? '—')],
    ['EMERGENCY CONTACT NAME', String(row.emergencyContactName ?? '—')],
    ['EMERGENCY CONTACT PHONE', String(row.emergencyContactPhone ?? '—')],
    ['EMERGENCY CONTACT EMAIL', String(row.emergencyContactEmail ?? '—')],
    ['EMERGENCY CONTACT RELATION', String(row.emergencyContactRelation ?? '—')],
    ['EMERGENCY CONTACT ADDRESS', String(row.emergencyContactAddress ?? '—')],
  ]
}

function buildLabeledDetailRows(fields: [string, string][]): Record<string, unknown>[][] {
  const rows: Record<string, unknown>[][] = []
  for (let i = 0; i < fields.length; i += 3) {
    const tableRow: Record<string, unknown>[] = []
    for (let j = 0; j < 3; j++) {
      const pair = fields[i + j]
      if (pair) {
        tableRow.push({ content: pair[0], styles: { fontStyle: 'bold' } }, { content: pair[1] })
      } else {
        tableRow.push({ content: '' }, { content: '' })
      }
    }
    rows.push(tableRow)
  }
  return rows
}

export async function exportToPDF<T extends Record<string, any>>(
  data: T[],
  filename: string,
  headers: { key: keyof T | string; label: string }[],
  options?: ExportPdfOptions,
) {
  if (!data.length) return

  const logo = options?.employeePdfStyle ? await fetchExportLogo() : null
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' })
  const now = new Date()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const genDate = `${String(now.getDate()).padStart(2, '0')}-${months[now.getMonth()]}-${now.getFullYear()}`

  let hours = now.getHours()
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12
  const genTime = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`
  const genBy = options?.generatedBy || 'Admin'

  const filterParts: string[] = []
  if (options?.filters) {
    Object.entries(options.filters).forEach(([key, val]) => {
      if (val && val !== 'all' && val !== '') {
        let displayKey = key
        if (key === 'employeeId') displayKey = 'Employee ID'
        else if (key === 'employmentType') displayKey = 'Type'
        else displayKey = key.charAt(0).toUpperCase() + key.slice(1)

        filterParts.push(`${displayKey} = ${val}`)
      }
    })
  }
  const filterString = filterParts.length > 0 ? filterParts.join(' | ') : 'None'

  const pageWidth = doc.internal.pageSize.width || 842
  const pageHeight = doc.internal.pageSize.height || 595
  const employeeStyle = Boolean(options?.employeePdfStyle)

  function drawHeaderBlock(): number {
<<<<<<< HEAD
    let y = 38
    let textX = 40
    let align: 'center' | 'left' = 'center'

    if (employeeStyle && logo) {
      const scaled = scaleExportLogo(logo.width, logo.height, 48)
      const format = EXPORT_LOGO_PATH.endsWith('.png') ? 'PNG' : 'JPEG'
      doc.addImage(logo.dataUrl, format, 40, 20, scaled.width, scaled.height)
      textX = 40 + scaled.width + 12
      y = 20
      align = 'left'
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    if (align === 'center') {
      drawEpicalBrandedText(doc, { before: 'EP', after: 'AL LAYOUTS PVT LTD' }, 40, y, 'center', pageWidth)
      y += 18
    } else {
      drawEpicalBrandedText(doc, { before: 'EP', after: 'AL LAYOUTS PVT LTD' }, textX, y + 16, 'left', pageWidth)
      y += 32
    }
=======
    let y: number
    const reportTitleStr = options?.reportTitle ?? 'Employee Details Report'

    if (employeeStyle && logo && options?.headerLogoAdjacentToTitle) {
      const { width: lw, height: lh } = scaleExportLogo(logo.width, logo.height, PDF_LOGO_MAX_WIDTH)
      /** Space between logo and text; group is horizontally centered as a unit. */
      const gap = 10
      const companyFontPt = 18
      const reportFontPt = 12
      const baselineStep = 17
>>>>>>> 13af5beca1171715405cd0431c6942cb53bc0d0f

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(companyFontPt)
      const companyW =
        doc.getTextWidth('EP') + doc.getTextWidth('IC') + doc.getTextWidth('AL LAYOUTS PVT LTD')
      doc.setFontSize(reportFontPt)
      const reportW = doc.getTextWidth(reportTitleStr)
      const textColW = Math.max(companyW, reportW)
      const groupW = lw + gap + textColW
      const groupLeft = pageWidth / 2 - groupW / 2
      const textLeft = groupLeft + lw + gap

      // Vertical: two-line stack then align logo midpoint to stack midpoint (Helvetica pt approx.).
      const companyBaseline = 36
      const reportBaseline = companyBaseline + baselineStep
      const companyAscApprox = companyFontPt * 0.72
      const reportDescApprox = reportFontPt * 0.28
      const textTop = companyBaseline - companyAscApprox
      const textBottom = reportBaseline + reportDescApprox
      const textMidY = (textTop + textBottom) / 2
      const logoTop = textMidY - lh / 2

      doc.addImage(logo.dataUrl, 'JPEG', groupLeft, logoTop, lw, lh)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(companyFontPt)
      drawEpicalBrandedText(
        doc,
        { before: 'EP', after: 'AL LAYOUTS PVT LTD' },
        textLeft,
        companyBaseline,
        'left',
        pageWidth,
      )
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(reportFontPt)
      doc.setTextColor(30, 41, 59)
      doc.text(reportTitleStr, textLeft, reportBaseline)
      y = Math.max(logoTop + lh, reportBaseline + reportDescApprox) + 14
    } else {
      y = employeeStyle && logo ? drawPdfLogoLeft(doc, logo, 40, 14) : 38

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      drawEpicalBrandedText(doc, { before: 'EP', after: 'AL LAYOUTS PVT LTD' }, 40, y, 'center', pageWidth)
      y += 18

      if (!employeeStyle) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(100, 116, 139)
        doc.text(options?.panelTitle ?? 'Document Management Panel', pageWidth / 2, y, { align: 'center' })
        y += 18

<<<<<<< HEAD
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(30, 41, 59)
    if (align === 'center') {
      doc.text(options?.reportTitle ?? 'Employee Details Report', pageWidth / 2, y, { align: 'center' })
    } else {
      doc.text(options?.reportTitle ?? 'Employee Details Report', textX, y, { align: 'left' })
    }
    y += 14
=======
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(16, 185, 129)
        doc.text('[ PDF Document ]', pageWidth / 2, y, { align: 'center' })
        y += 12
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(30, 41, 59)
      doc.text(reportTitleStr, pageWidth / 2, y, { align: 'center' })
      y += 14
    }
>>>>>>> 13af5beca1171715405cd0431c6942cb53bc0d0f

    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(1)
    doc.line(40, y, pageWidth - 40, y)
    y += 19

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(71, 85, 105)
    doc.text(`Generated Date : ${genDate}`, 40, y, { align: 'left' })
    doc.text(`Generated Time : ${genTime}`, pageWidth / 2, y, { align: 'center' })
    doc.text(`Generated By : ${genBy}`, pageWidth - 40, y, { align: 'right' })
    y += 20

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 41, 59)
    doc.text('Applied Filters: ', 40, y)
    const filterLabelWidth = doc.getTextWidth('Applied Filters: ')
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(filterString, 40 + filterLabelWidth, y)
    y += 13

    doc.setDrawColor(226, 232, 240)
    doc.line(40, y, pageWidth - 40, y)
    return y
  }

  function drawFooters() {
    const totalPages = doc.getNumberOfPages()
    const footerY = pageHeight - 30

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(1)
      doc.line(40, footerY - 12, pageWidth - 40, footerY - 12)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      drawEpicalBrandedText(
        doc,
        { before: 'EP', after: 'AL LAYOUTS PVT LTD – Confidential Document' },
        40,
        footerY,
        'left',
        pageWidth,
        'normal',
      )
      doc.text(`System Generated Report | Generated on ${genDate} ${genTime}`, pageWidth / 2, footerY, {
        align: 'center',
      })
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 40, footerY, { align: 'right' })
    }
  }

  if (!options?.employeeDetailMode) {
    const tableStartY = drawHeaderBlock() + 12

    const tableData = [
      headers.map((h) => h.label),
      ...data.map((row) =>
        headers.map((h) => {
          let value: unknown = row[h.key as keyof T]
          if (h.key === 'joinedAt' || h.key === 'dob') {
            value = formatDateStr(value as string)
          } else if (h.key === 'pfEsi') {
            value = value === 'on' ? 'Enabled' : value === 'off' ? 'Disabled' : '—'
          } else if (h.key === 'ctc' && typeof value === 'number') {
            value = `₹${value.toLocaleString('en-IN')}`
          }
          return value === null || value === undefined ? '—' : String(value)
        }),
      ),
    ]

    autoTable(doc, {
      head: [tableData[0]],
      body: tableData.slice(1),
      startY: tableStartY,
      styles: { fontSize: 8, cellPadding: 4, valign: 'middle', overflow: 'linebreak' },
      theme: 'grid',
      margin: { left: 10, right: 10, top: tableStartY, bottom: 50 },
      columnStyles: headers.reduce(
        (acc, _, idx) => {
          acc[idx] = { cellWidth: (pageWidth - 20) / headers.length }
          return acc
        },
        {} as any,
      ),
    })

    drawFooters()
    doc.save(`${filename}.pdf`)
    return
  }

  data.forEach((e, index) => {
    if (index > 0) doc.addPage()

    const headerEndY = drawHeaderBlock()

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(16, 185, 129)
    const empName = `${e.firstName} ${e.lastName || ''}`.trim().toUpperCase()
    doc.text(`${index + 1}. ${empName} (${e.employeeId})`, 40, headerEndY + 14)

    autoTable(doc, {
      body: buildLabeledDetailRows(buildIndividualDetailFields(e)),
      startY: headerEndY + 24,
      styles: { fontSize: 8.5, cellPadding: 5, valign: 'middle', overflow: 'linebreak' },
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 88, fontStyle: 'bold' },
        1: { cellWidth: 175 },
        2: { cellWidth: 88, fontStyle: 'bold' },
        3: { cellWidth: 175 },
        4: { cellWidth: 88, fontStyle: 'bold' },
        5: { cellWidth: 175 },
      },
      margin: { left: 40, right: 40, bottom: 60 },
    })
  })

  drawFooters()
  doc.save(`${filename}.pdf`)
}
