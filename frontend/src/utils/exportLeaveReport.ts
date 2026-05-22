import type { Holiday, LeaveRequest } from '@/types'
import { exportToExcel } from '@/utils/exportExcel'
import { exportToPDF } from '@/utils/exportPDF'
import { formatDate, formatDateTime } from '@/utils/formatDate'

export type LeaveExportRow = {
  employeeName: string
  employeeId: string
  leaveType: string
  fromDate: string
  toDate: string
  days: number
  status: string
  reason: string
  rejectionReason: string
  appliedDate: string
  approvalDate: string
}

export const LEAVE_EXPORT_HEADERS: { key: keyof LeaveExportRow; label: string }[] = [
  { key: 'employeeName', label: 'Employee Name' },
  { key: 'employeeId', label: 'Employee ID' },
  { key: 'leaveType', label: 'Leave Type' },
  { key: 'fromDate', label: 'From Date' },
  { key: 'toDate', label: 'To Date' },
  { key: 'days', label: 'Days' },
  { key: 'status', label: 'Status' },
  { key: 'reason', label: 'Reason' },
  { key: 'rejectionReason', label: 'Rejection Reason' },
  { key: 'appliedDate', label: 'Applied Date' },
  { key: 'approvalDate', label: 'Approval Date' },
]

function toExportTimestamp(value: unknown): string {
  if (!value) return '—'
  if (typeof value === 'string') return formatDateTime(value)
  if (value instanceof Date) return formatDateTime(value)
  return '—'
}

export function mapLeaveToExportRow(leave: LeaveRequest): LeaveExportRow {
  return {
    employeeName: leave.employeeName,
    employeeId: leave.employeeId,
    leaveType: leave.type,
    fromDate: formatDate(leave.from),
    toDate: formatDate(leave.to),
    days: leave.days,
    status: leave.status,
    reason: leave.reason || '—',
    rejectionReason: leave.rejectionReason || '—',
    appliedDate: toExportTimestamp(leave.createdAt),
    approvalDate: leave.approvalDate ? formatDate(leave.approvalDate) : '—',
  }
}

const LEAVE_REPORT_OPTIONS = {
  panelTitle: 'Leave Management Panel',
  reportTitle: 'Leave Management Report',
  sheetName: 'Leave Requests',
}

export function exportLeavesToPDF(
  leaves: LeaveRequest[],
  filename: string,
  filters: Record<string, string | undefined>,
  generatedBy?: string,
) {
  const rows = leaves.map(mapLeaveToExportRow)
  exportToPDF(rows, filename, LEAVE_EXPORT_HEADERS, {
    generatedBy,
    filters,
    compactMode: true,
    ...LEAVE_REPORT_OPTIONS,
  })
}

export function exportLeavesToExcel(
  leaves: LeaveRequest[],
  filename: string,
  filters: Record<string, string | undefined>,
  generatedBy?: string,
) {
  const rows = leaves.map(mapLeaveToExportRow)
  exportToExcel(rows, filename, LEAVE_EXPORT_HEADERS, {
    generatedBy,
    filters,
    ...LEAVE_REPORT_OPTIONS,
  })
}

export type CompensationExportRow = {
  employeeName: string
  employeeId: string
  compensationDays: number
  reason: string
  appliedDate: string
  createdBy: string
}

export const COMPENSATION_EXPORT_HEADERS: { key: keyof CompensationExportRow; label: string }[] = [
  { key: 'employeeName', label: 'Employee Name' },
  { key: 'employeeId', label: 'Employee ID' },
  { key: 'compensationDays', label: 'Compensation Days' },
  { key: 'reason', label: 'Reason' },
  { key: 'appliedDate', label: 'Applied Date' },
  { key: 'createdBy', label: 'Created By' },
]

export function exportCompensationToPDF(
  rows: CompensationExportRow[],
  filename: string,
  filters: Record<string, string | undefined>,
  generatedBy?: string,
) {
  exportToPDF(rows, filename, COMPENSATION_EXPORT_HEADERS, {
    generatedBy,
    filters,
    compactMode: true,
    panelTitle: 'Leave Management Panel',
    reportTitle: 'Compensation Management Report',
  })
}

export function exportCompensationToExcel(
  rows: CompensationExportRow[],
  filename: string,
  filters: Record<string, string | undefined>,
  generatedBy?: string,
) {
  exportToExcel(rows, filename, COMPENSATION_EXPORT_HEADERS, {
    generatedBy,
    filters,
    panelTitle: 'Leave Management Panel',
    reportTitle: 'Compensation Management Report',
    sheetName: 'Compensation',
  })
}

export type HolidayExportRow = {
  title: string
  date: string
  type: string
  description: string
}

export const HOLIDAY_EXPORT_HEADERS: { key: keyof HolidayExportRow; label: string }[] = [
  { key: 'title', label: 'Holiday Title' },
  { key: 'date', label: 'Date' },
  { key: 'type', label: 'Type' },
  { key: 'description', label: 'Description' },
]

export function mapHolidayToExportRow(holiday: Holiday): HolidayExportRow {
  return {
    title: holiday.title,
    date: formatDate(holiday.date),
    type: holiday.type ?? 'National',
    description: holiday.description || '—',
  }
}

export function exportHolidaysToPDF(
  holidays: Holiday[],
  filename: string,
  filters: Record<string, string | undefined>,
  generatedBy?: string,
) {
  const rows = holidays.map(mapHolidayToExportRow)
  exportToPDF(rows, filename, HOLIDAY_EXPORT_HEADERS, {
    generatedBy,
    filters,
    compactMode: true,
    panelTitle: 'Leave Management Panel',
    reportTitle: 'Company Calendar — Holidays Report',
  })
}

export function exportHolidaysToExcel(
  holidays: Holiday[],
  filename: string,
  filters: Record<string, string | undefined>,
  generatedBy?: string,
) {
  const rows = holidays.map(mapHolidayToExportRow)
  exportToExcel(rows, filename, HOLIDAY_EXPORT_HEADERS, {
    generatedBy,
    filters,
    panelTitle: 'Leave Management Panel',
    reportTitle: 'Company Calendar — Holidays Report',
    sheetName: 'Holidays',
  })
}
