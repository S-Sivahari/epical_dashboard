import type { Company } from './payslipGenerator'
import { parsePayPeriodFromCompany } from './payrollYtdService'

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
]

function sanitizeNamePart(name: string): string {
  const cleaned = String(name ?? '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
  return cleaned.toLowerCase() || 'employee'
}

function monthYearFromPeriodKey(
  payPeriodKey: string
): { month: string; year: string } | null {
  const match = payPeriodKey.trim().match(/^(\d{4})-(\d{2})$/)
  if (!match) return null
  const year = match[1]
  const monthNum = parseInt(match[2], 10)
  if (monthNum < 1 || monthNum > 12) return null
  return { month: MONTH_NAMES[monthNum - 1], year }
}

function monthYearFromPayMonth(payMonth: string): { month: string; year: string } {
  const period = parsePayPeriodFromCompany({ 'Pay Month': payMonth } as Company)
  return {
    month: MONTH_NAMES[period.month - 1] ?? String(period.month),
    year: String(period.year),
  }
}

/** Browser download name: payslip_name_month_year.pdf */
export function formatPayslipDownloadFileName(
  employeeName: string,
  payMonth?: string | null,
  payPeriodKey?: string | null
): string {
  const namePart = sanitizeNamePart(employeeName)
  let monthYear = payPeriodKey ? monthYearFromPeriodKey(payPeriodKey) : null
  if (!monthYear && payMonth) {
    monthYear = monthYearFromPayMonth(payMonth)
  }
  if (!monthYear) {
    const now = new Date()
    monthYear = {
      month: MONTH_NAMES[now.getMonth()],
      year: String(now.getFullYear()),
    }
  }
  return `payslip_${namePart}_${monthYear.month}_${monthYear.year}.pdf`
}
