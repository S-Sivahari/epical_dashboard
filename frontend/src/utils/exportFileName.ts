const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const

/** dd-mm-yyyy for export file names */
export function formatExportDateDDMMYYYY(date = new Date()): string {
  const d = date.getDate()
  const m = date.getMonth() + 1
  const y = date.getFullYear()
  return `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`
}

export function sanitizeExportPart(value: string, fallback = 'export'): string {
  const cleaned = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  return (cleaned || fallback).slice(0, 72)
}

/** Base name without extension: category_part1_part2_dd-mm-yyyy */
export function buildExportFileName(
  category: string,
  parts: (string | undefined | null)[] = [],
  date = new Date(),
): string {
  const segments = [
    sanitizeExportPart(category, 'export'),
    ...parts.map((p) => (p ? sanitizeExportPart(p) : '')).filter(Boolean),
    formatExportDateDDMMYYYY(date),
  ]
  return segments.join('_')
}

export function buildExportFileNameWithExtension(
  category: string,
  extension: 'pdf' | 'xlsx' | 'csv',
  parts: (string | undefined | null)[] = [],
  date = new Date(),
): string {
  return `${buildExportFileName(category, parts, date)}.${extension}`
}

export function formatIsoDateToDDMMYYYY(iso: string): string {
  const trimmed = String(iso ?? '').trim()
  if (!trimmed) return formatExportDateDDMMYYYY()
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`
  }
  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) return formatExportDateDDMMYYYY(parsed)
  return sanitizeExportPart(trimmed.replace(/-/g, '_'))
}

function monthYearSlugFromPayMonth(payMonth?: string | null, payPeriodKey?: string | null): string {
  if (payPeriodKey) {
    const match = payPeriodKey.trim().match(/^(\d{4})-(\d{2})$/)
    if (match) {
      const monthNum = parseInt(match[2], 10)
      if (monthNum >= 1 && monthNum <= 12) {
        return `${MONTH_NAMES[monthNum - 1]}_${match[1]}`
      }
    }
  }

  const trimmed = String(payMonth ?? '').trim()
  if (!trimmed) return 'period'

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})$/)
  if (isoMatch) {
    const monthNum = parseInt(isoMatch[2], 10)
    if (monthNum >= 1 && monthNum <= 12) {
      return `${MONTH_NAMES[monthNum - 1]}_${isoMatch[1]}`
    }
  }

  const yearMatch = trimmed.match(/\b(20\d{2})\b/)
  const year = yearMatch ? yearMatch[1] : String(new Date().getFullYear())
  const monthEntry = MONTH_NAMES.find((name) => trimmed.toLowerCase().includes(name))
  if (monthEntry) return `${monthEntry}_${year}`

  return sanitizeExportPart(trimmed, 'period')
}

export function formatPayslipDownloadFileName(
  employeeName: string,
  payMonth?: string | null,
  payPeriodKey?: string | null,
  exportDate = new Date(),
): string {
  return buildExportFileNameWithExtension(
    'payslip',
    'pdf',
    [sanitizeExportPart(employeeName, 'employee'), monthYearSlugFromPayMonth(payMonth, payPeriodKey)],
    exportDate,
  )
}

export function formatAllPayslipsDownloadFileName(
  payMonth?: string | null,
  payPeriodKey?: string | null,
  exportDate = new Date(),
): string {
  return buildExportFileNameWithExtension(
    'payslips_all',
    'pdf',
    [monthYearSlugFromPayMonth(payMonth, payPeriodKey)],
    exportDate,
  )
}

export function payrollUploadExcelFileName(
  payMonth?: string | null,
  payPeriodKey?: string | null,
  exportDate = new Date(),
): string {
  return buildExportFileNameWithExtension(
    'payroll_upload',
    'xlsx',
    [monthYearSlugFromPayMonth(payMonth, payPeriodKey)],
    exportDate,
  )
}

export function payrollMasterTemplateFileName(exportDate = new Date()): string {
  return `Payroll_Template_${formatExportDateDDMMYYYY(exportDate)}.xlsx`
}

export function documentDownloadFileName(documentName: string, documentType?: string): string {
  const typePart = documentType ? sanitizeExportPart(documentType) : undefined
  const namePart = sanitizeExportPart(documentName, 'document')
  return buildExportFileNameWithExtension(
    'document',
    'pdf',
    typePart && typePart !== namePart ? [typePart, namePart] : [namePart],
  )
}

export function timesheetReportFileName(
  startDate: string,
  endDate: string,
  extension: 'pdf' | 'xlsx',
  exportDate = new Date(),
): string {
  return buildExportFileNameWithExtension(
    'timesheet_report',
    extension,
    [formatIsoDateToDDMMYYYY(startDate), 'to', formatIsoDateToDDMMYYYY(endDate)],
    exportDate,
  )
}

export function leaveExportFileName(tab: 'requests' | 'compensation', exportDate = new Date()): string {
  const category = tab === 'requests' ? 'leave_requests' : 'leave_compensation'
  return buildExportFileName(category, [], exportDate)
}

export function employeeAnalyticsFileName(
  employeeId: string,
  employeeName: string,
  periodLabel: string,
  exportDate = new Date(),
): string {
  return buildExportFileNameWithExtension(
    'employee_analytics',
    'pdf',
    [
      sanitizeExportPart(employeeId, 'employee'),
      sanitizeExportPart(employeeName, 'employee'),
      sanitizeExportPart(periodLabel, 'period'),
    ],
    exportDate,
  )
}
