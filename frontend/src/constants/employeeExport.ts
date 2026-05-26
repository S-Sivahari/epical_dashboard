import type { Employee } from '@/types'

/** Columns shown in Active Directory — used for directory PDF/Excel exports only. */
export const ACTIVE_DIRECTORY_EXPORT_HEADERS: { key: keyof Employee; label: string }[] = [
  { key: 'employeeId', label: 'Employee ID' },
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'personalEmail', label: 'Personal Email' },
  { key: 'email', label: 'Company Email' },
  { key: 'employmentType', label: 'Type' },
  { key: 'joinedAt', label: 'Joined' },
  { key: 'status', label: 'Status' },
]

export type EmployeeExportRow = Record<string, unknown>

/** Full employee record — used for individual profile PDF/Excel exports. */
export const FULL_EMPLOYEE_EXPORT_HEADERS: { key: string; label: string }[] = [
  { key: 'employeeId', label: 'Employee ID' },
  { key: 'firstName', label: 'First Name' },
  { key: 'middleName', label: 'Middle Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'dob', label: 'Date of Birth' },
  { key: 'gender', label: 'Gender' },
  { key: 'phone', label: 'Phone' },
  { key: 'personalEmail', label: 'Personal Email' },
  { key: 'email', label: 'Company Email' },
  { key: 'permanentAddress', label: 'Permanent Address' },
  { key: 'communicationAddress', label: 'Communication Address' },
  { key: 'role', label: 'Role' },
  { key: 'department', label: 'Department' },
  { key: 'designation', label: 'Designation' },
  { key: 'employmentType', label: 'Employment Type' },
  { key: 'joinedAt', label: 'Joined At' },
  { key: 'status', label: 'Status' },
  { key: 'reportingManager', label: 'Reporting Manager' },
  { key: 'ctc', label: 'CTC (Annual)' },
  { key: 'bankName', label: 'Bank Name' },
  { key: 'accountNumber', label: 'Account Number' },
  { key: 'ifsc', label: 'IFSC Code' },
  { key: 'uan', label: 'UAN Number' },
  { key: 'pfEsi', label: 'PF / ESI' },
  { key: 'aadhaar', label: 'Aadhaar Number' },
  { key: 'pan', label: 'PAN' },
  { key: 'passport', label: 'Passport Number' },
  { key: 'emergencyContactName', label: 'Emergency Contact Name' },
  { key: 'emergencyContactPhone', label: 'Emergency Contact Phone' },
  { key: 'emergencyContactEmail', label: 'Emergency Contact Email' },
  { key: 'emergencyContactRelation', label: 'Emergency Contact Relation' },
  { key: 'emergencyContactAddress', label: 'Emergency Contact Address' },
]

function formatExportDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/\s+/g, '_').replace(/[^\w-]/g, '')
}

export function activeDirectoryExportFilename(date = new Date()): string {
  return `EpicalLayouts_EmployeeDetails_${formatExportDate(date)}`
}

export function individualExportFilename(firstName: string, lastName: string | undefined, date = new Date()): string {
  const name = sanitizeFilenamePart(`${firstName}_${lastName ?? ''}`.trim())
  return `EpicalLayouts_${name}_EmployeeDetails_${formatExportDate(date)}`
}

export function employeeToExportRow(employee: Employee): EmployeeExportRow {
  const e = employee as Employee & {
    permanentAddress?: string
    communicationAddress?: string
    address?: string
  }
  const ec = employee.emergencyContact
  return {
    ...employee,
    permanentAddress: e.permanentAddress ?? e.address ?? '',
    communicationAddress: e.communicationAddress ?? '',
    emergencyContactName: ec?.name ?? '',
    emergencyContactPhone: ec?.phone ?? '',
    emergencyContactEmail: ec?.email ?? '',
    emergencyContactRelation: ec?.relation ?? '',
    emergencyContactAddress: ec?.address ?? '',
  }
}

export const ACTIVE_DIRECTORY_REPORT_OPTIONS = {
  reportTitle: 'Employee Details Report',
  sheetName: 'Employee Details',
  employeePdfStyle: true,
}

export const INDIVIDUAL_EMPLOYEE_REPORT_OPTIONS = {
  reportTitle: 'Employee Details Report',
  sheetName: 'Employee Details',
  employeePdfStyle: true,
}
