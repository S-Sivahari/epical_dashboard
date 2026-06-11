import type { PayPeriod } from './payrollYtdService'
import type { Employee } from './payslipGenerator'
import { findEmployeeByPayrollEmpId } from './employeePayslipService'
import { getLeaveBalances } from './leaveService'

const LEAVE_BALANCE_FIELDS = {
  'EL Balance': {
    dbType: 'Earned Leave',
  },
  'CL Balance': {
    dbType: 'Casual Leave',
  },
  'SL Balance': {
    dbType: 'Sick Leave',
  },
  'Comp Off': {
    dbType: 'Compensation Leave',
  },
} as const

function pickEmployeeField(emp: Employee, keys: string[]): unknown {
  for (const key of keys) {
    const val = emp[key]
    if (val !== undefined && val !== null && String(val).trim() !== '') return val
  }
  const lowerKeys = new Set(keys.map((k) => k.toLowerCase()))
  for (const [key, val] of Object.entries(emp)) {
    if (!lowerKeys.has(key.toLowerCase())) continue
    if (val !== undefined && val !== null && String(val).trim() !== '') return val
  }
  return undefined
}

export function formatLeaveBalanceDisplay(value: unknown): string {
  if (value === undefined || value === null || String(value).trim() === '') return '0'
  const n = parseFloat(String(value))
  if (!Number.isNaN(n)) {
    if (Number.isInteger(n)) return String(n)
    return String(Number(n.toFixed(1)))
  }
  return String(value).trim()
}

/** Last calendar day of the pay month (used as balance snapshot date). */
export function payPeriodRefDate(period: PayPeriod): Date {
  return new Date(period.year, period.month, 0, 23, 59, 59, 999)
}

/** Employee must have joined on or before the pay month to show leave balances. */
export function isEmployeeActiveInPayPeriod(
  joinedAt: string | undefined,
  period: PayPeriod,
): boolean {
  if (!joinedAt?.trim()) return true
  const join = new Date(`${joinedAt.trim()}T12:00:00Z`)
  if (Number.isNaN(join.getTime())) return true
  const payMonthEnd = new Date(period.year, period.month, 0, 23, 59, 59, 999)
  return join.getTime() <= payMonthEnd.getTime()
}

/**
 * Resolve leave balances and LOP for payslip from HR leave system only (never Excel).
 */
export async function enrichPayrollEmployeeLeaveBalances(
  emp: Employee,
  payPeriod?: PayPeriod,
): Promise<Employee> {
  const empId = String(emp['Emp ID'] || '').trim()
  const next: Employee = { ...emp }

  if (!empId) {
    for (const canonicalKey of Object.keys(LEAVE_BALANCE_FIELDS)) {
      next[canonicalKey] = '0'
    }
    next['LOP Days'] = '0'
    return next
  }

  let joinedAt: string | undefined
  try {
    const dbEmployee = await findEmployeeByPayrollEmpId(empId)
    joinedAt = dbEmployee?.joinedAt ? String(dbEmployee.joinedAt) : undefined
  } catch (error) {
    console.warn(`Failed to resolve employee ${empId} for leave enrichment:`, error)
  }

  if (payPeriod && !isEmployeeActiveInPayPeriod(joinedAt, payPeriod)) {
    for (const canonicalKey of Object.keys(LEAVE_BALANCE_FIELDS)) {
      next[canonicalKey] = '0'
    }
    next['LOP Days'] = '0'
    return next
  }

  const refDate = payPeriod ? payPeriodRefDate(payPeriod) : new Date()

  try {
    const balances = await getLeaveBalances(empId, refDate)

    for (const [canonicalKey, config] of Object.entries(LEAVE_BALANCE_FIELDS)) {
      const remaining = balances[config.dbType]?.remaining
      next[canonicalKey] =
        remaining !== undefined && remaining !== null
          ? formatLeaveBalanceDisplay(remaining)
          : '0'
    }

    next['LOP Days'] = formatLeaveBalanceDisplay(balances['LOP Days']?.used ?? 0)
  } catch (error) {
    console.warn(`Failed to load leave balances for ${empId}:`, error)
    for (const canonicalKey of Object.keys(LEAVE_BALANCE_FIELDS)) {
      next[canonicalKey] = '0'
    }
    next['LOP Days'] = '0'
  }

  return next
}

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
