import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Employee } from '@/types'
import type {
  AnalyticsMetrics,
  AnalyticsPeriodPreset,
  AttendanceSummary,
  WeekdayHours,
} from '@/services/analyticsService'
import { employeeDisplayName } from '@/services/analyticsService'
import { fetchExportLogo, scaleExportLogo } from '@/utils/exportLogo'
import { employeeAnalyticsFileName } from '@/utils/exportFileName'

const BRAND_GREEN: [number, number, number] = [6, 192, 51]

export interface EmployeeAnalyticsReportPayload {
  employee: Employee
  preset: AnalyticsPeriodPreset
  year: number
  month: number
  periodLabel: string
  weekly: WeekdayHours[]
  metrics: AnalyticsMetrics
  attendance: AttendanceSummary
  generatedBy: string
}

function pdfSafeText(value: string) {
  return value
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u00b7/g, '-')
    .replace(/[^\x00-\x7F]/g, (ch) => {
      const map: Record<string, string> = { '—': '-', '–': '-', '·': '-', '’': "'", '‘': "'", '“': '"', '”': '"' }
      return map[ch] ?? ''
    })
}
function formatReportDate(d: Date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()}`
}

function formatReportTime(d: Date) {
  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`
}

function drawEpicalBrandedText(
  doc: jsPDF,
  parts: { before: string; after: string },
  x: number,
  y: number,
  align: 'left' | 'center' = 'left',
  pageWidth = doc.internal.pageSize.width,
  fontSize = 16,
) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(fontSize)
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
}

function renderWeeklyChartImage(weekly: WeekdayHours[], width: number, height: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  const pad = { l: 44, r: 16, t: 24, b: 36 }
  const chartW = width - pad.l - pad.r
  const chartH = height - pad.t - pad.b
  const peak = Math.max(8, ...weekly.map((d) => d.hours))
  const yMax = Math.ceil(peak * 1.2)

  ctx.strokeStyle = 'rgba(6, 192, 51, 0.15)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (chartH / 4) * i
    ctx.beginPath()
    ctx.moveTo(pad.l, y)
    ctx.lineTo(width - pad.r, y)
    ctx.stroke()
  }

  ctx.fillStyle = '#64748b'
  ctx.font = '11px Helvetica, Arial, sans-serif'
  ctx.textAlign = 'right'
  for (let i = 0; i <= 4; i++) {
    const val = Math.round(yMax - (yMax / 4) * i)
    const y = pad.t + (chartH / 4) * i + 4
    ctx.fillText(`${val}h`, pad.l - 6, y)
  }

  const points = weekly.map((d, i) => {
    const x = pad.l + (chartW / Math.max(weekly.length - 1, 1)) * i
    const y = pad.t + chartH - (d.hours / yMax) * chartH
    return { x, y, ...d }
  })

  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + chartH)
  grad.addColorStop(0, 'rgba(74, 222, 128, 0.55)')
  grad.addColorStop(0.5, 'rgba(34, 197, 94, 0.25)')
  grad.addColorStop(1, 'rgba(6, 192, 51, 0.04)')

  ctx.beginPath()
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  })
  ctx.lineTo(points[points.length - 1].x, pad.t + chartH)
  ctx.lineTo(points[0].x, pad.t + chartH)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  ctx.beginPath()
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  })
  ctx.strokeStyle = '#06C033'
  ctx.lineWidth = 2.5
  ctx.stroke()

  points.forEach((p) => {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#06C033'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 11px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${p.hours}h`, p.x, p.y - 10)
  })

  ctx.fillStyle = '#64748b'
  ctx.font = '600 11px Helvetica, Arial, sans-serif'
  ctx.textAlign = 'center'
  points.forEach((p) => {
    ctx.fillText(p.name, p.x, height - 12)
  })

  return canvas.toDataURL('image/png')
}

export async function exportEmployeeAnalyticsReport(payload: EmployeeAnalyticsReportPayload) {
  const {
    employee,
    periodLabel,
    weekly,
    metrics,
    attendance,
    generatedBy,
  } = payload

  const logo = await fetchExportLogo()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.width
  const pageHeight = doc.internal.pageSize.height
  const marginX = 40
  const contentWidth = pageWidth - marginX * 2
  const footerTop = pageHeight - 52
  const footerRow1Y = pageHeight - 36
  const footerRow2Y = pageHeight - 24

  const now = new Date()
  const genDate = formatReportDate(now)
  const genTime = formatReportTime(now)

  let genDateStr = ''
  let genTimeStr = ''

  const ensureSpace = (needed: number, currentY: number) => {
    if (currentY + needed > footerTop - 12) {
      doc.addPage()
      return 48
    }
    return currentY
  }

  const drawFooters = () => {
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.75)
      doc.line(marginX, footerTop, pageWidth - marginX, footerTop)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(100, 116, 139)

      drawEpicalBrandedText(
        doc,
        { before: 'EP', after: 'AL LAYOUTS PVT LTD' },
        marginX,
        footerRow1Y,
        'left',
        pageWidth,
        7.5,
      )
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - marginX, footerRow1Y, { align: 'right' })

      doc.setFont('helvetica', 'normal')
      doc.text(
        pdfSafeText(
          `Confidential Document   |   System Generated Report   |   Generated on ${genDateStr} ${genTimeStr}`,
        ),
        pageWidth / 2,
        footerRow2Y,
        { align: 'center' },
      )
    }
  }

  genDateStr = genDate
  genTimeStr = genTime

  let y = 28
  let logoW = 0
  if (logo) {
    const scaled = scaleExportLogo(logo.width, logo.height, 56)
    const format = logo.dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
    doc.addImage(logo.dataUrl, format, marginX, y, scaled.width, scaled.height)
    logoW = scaled.width + 12
  }

  drawEpicalBrandedText(doc, { before: 'EP', after: 'AL LAYOUTS PVT LTD' }, marginX + logoW, y + 22, 'left', pageWidth, 17)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  doc.text('Employee Analytics Report', marginX + logoW, y + 40)

  y = Math.max(y + 52, 88)
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(1)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 18

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(`Generated Date : ${genDate}`, marginX, y)
  doc.text(`Generated Time : ${genTime}`, pageWidth / 2, y, { align: 'center' })
  doc.text(`Generated By : ${generatedBy}`, pageWidth - marginX, y, { align: 'right' })
  y += 16

  doc.setDrawColor(226, 232, 240)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 18

  const empName = employeeDisplayName(employee)
  autoTable(doc, {
    body: [
      ['Employee Name', empName, 'Employee ID', employee.employeeId],
      ['Department', employee.department || '—', 'Designation', employee.designation || '—'],
      ['Reporting Period', pdfSafeText(periodLabel), 'Employment Type', employee.employmentType || '—'],
    ],
    startY: y,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [240, 253, 244], cellWidth: 90 },
      1: { cellWidth: contentWidth / 2 - 90 },
      2: { fontStyle: 'bold', fillColor: [240, 253, 244], cellWidth: 90 },
      3: { cellWidth: contentWidth / 2 - 90 },
    },
    margin: { left: marginX, right: marginX },
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20

  const sectionTitle = (title: string, startY: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...BRAND_GREEN)
    doc.text(title, marginX, startY)
    doc.setDrawColor(...BRAND_GREEN)
    doc.setLineWidth(1)
    doc.line(marginX, startY + 4, pageWidth - marginX, startY + 4)
    return startY + 18
  }

  y = sectionTitle('Performance Summary', y)

  autoTable(doc, {
    body: [
      ['Attendance Percentage', `${attendance.attendancePercentage}%`],
      ['Total Working Days', String(attendance.totalWorkingDays)],
      ['Present Days', String(attendance.presentDays)],
      ['Leave Days', String(attendance.leaveDays)],
      ['Hours Logged', `${attendance.hoursLogged} hrs`],
      ['Productivity Score', `${attendance.productivityScore}%`],
      ['Avg Hours / Week', `${metrics.avgHoursPerWeek} hrs`],
    ],
    startY: y,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 6 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: contentWidth * 0.45 },
      1: { cellWidth: contentWidth * 0.55 },
    },
    margin: { left: marginX, right: marginX },
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22
  y = ensureSpace(200, y)
  y = sectionTitle('Weekly Performance', y)

  const weeklyChart = renderWeeklyChartImage(weekly, Math.round(contentWidth * 2), 220)
  doc.addImage(weeklyChart, 'PNG', marginX, y, contentWidth, 130)

  drawFooters()

  doc.save(
    employeeAnalyticsFileName(
      employee.employeeId ?? employee.id ?? 'employee',
      empName,
      periodLabel,
      now,
    ),
  )
}
