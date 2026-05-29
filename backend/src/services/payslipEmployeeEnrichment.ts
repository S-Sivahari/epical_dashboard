import type { Employee } from './payslipGenerator'
import { findEmployeeByPayrollEmpId } from './employeePayslipService'

function coalesceStr(...values: unknown[]): string {
  for (const v of values) {
    const s = String(v ?? '').trim()
    if (s) return s
  }
  return ''
}

function formatDbEmployeeName(db: Record<string, unknown>): string {
  return [db.firstName, db.middleName, db.lastName].filter(Boolean).join(' ').trim()
}

/** Payslip shows "Aadhaar (last 4)" — derive last four digits when full number is stored. */
function aadhaarForPayslip(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length >= 4) return digits.slice(-4)
  return value.trim()
}

function mergeStatutoryFromDb(emp: Employee, db: Record<string, unknown>): Employee {
  const aadhaarRaw = coalesceStr(db.aadhaar, emp['Aadhaar'], emp['Aadhaar (last 4)'])
  const aadhaar = aadhaarRaw ? aadhaarForPayslip(aadhaarRaw) : ''

  return {
    ...emp,
    Name: coalesceStr(formatDbEmployeeName(db), emp['Name']),
    Designation: coalesceStr(db.designation, emp['Designation']),
    Department: coalesceStr(db.role, emp['Department']),
    PAN: coalesceStr(db.pan, emp['PAN']),
    Aadhaar: aadhaar,
    'Aadhaar (last 4)': aadhaar,
    Bank: coalesceStr(db.bankName, emp['Bank'], emp['Bank Name']),
    'Bank Name': coalesceStr(db.bankName, emp['Bank Name'], emp['Bank']),
    'A/C No': coalesceStr(db.accountNumber, emp['A/C No'], emp['Account Number']),
    'Account Number': coalesceStr(db.accountNumber, emp['Account Number'], emp['A/C No']),
    IFSC: coalesceStr(db.ifsc, emp['IFSC']),
    UAN: coalesceStr(db.uan, emp['UAN']),
  }
}

/**
 * Enrich payroll Excel row with HR database fields (name, statutory IDs, bank details).
 * DB values take precedence when present; Excel values are kept as fallback.
 */
export async function enrichPayrollEmployeeFromDb(emp: Employee): Promise<Employee> {
  const empId = String(emp['Emp ID'] || '').trim()

  if (!empId) {
    return emp
  }

  try {
    const dbEmployee = await findEmployeeByPayrollEmpId(empId)

    if (dbEmployee) {
      return mergeStatutoryFromDb(emp, dbEmployee as Record<string, unknown>)
    }
  } catch (error) {
    console.warn(`Failed to enrich employee ${empId} from database:`, error)
  }

  return emp
}
