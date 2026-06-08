import type { Company } from './payslipGenerator'
import { parsePayPeriodFromCompany } from './payrollYtdService'
import {
  formatPayslipDownloadFileName as formatPayslipDownloadFileNameBase,
  formatAllPayslipsDownloadFileName,
  payrollUploadExcelFileName,
  payrollMasterTemplateFileName,
} from '../utils/exportFileName'

export { formatAllPayslipsDownloadFileName, payrollUploadExcelFileName, payrollMasterTemplateFileName }

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

function monthYearFromPayMonth(payMonth: string): { month: string; year: string } {
  const period = parsePayPeriodFromCompany({ 'Pay Month': payMonth } as Company)
  return {
    month: MONTH_NAMES[period.month - 1] ?? String(period.month),
    year: String(period.year),
  }
}

/** Title bar label: "Payslip for May 2026" */
export function formatPayslipTitleLabel(payMonth?: string | null): string {
  const raw = String(payMonth ?? '').trim()
  if (!raw) return 'Payslip'
  const { month, year } = monthYearFromPayMonth(raw)
  const monthTitle = month.charAt(0).toUpperCase() + month.slice(1)
  return `Payslip for ${monthTitle} ${year}`
}

export function formatPayslipDownloadFileName(
  employeeName: string,
  payMonth?: string | null,
  payPeriodKey?: string | null,
): string {
  return formatPayslipDownloadFileNameBase(employeeName, payMonth, payPeriodKey)
}
