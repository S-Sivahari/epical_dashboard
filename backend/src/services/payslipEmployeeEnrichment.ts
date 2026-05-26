import { getDB } from '../config/db'
import type { Employee } from './payslipGenerator'
import { findEmployeeByPayrollEmpId } from './employeePayslipService'
import { getLeaveBalances } from './leaveService'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatPayslipDate(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  const day = String(d.getDate()).padStart(2, '0')
  return `${day}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`
}

function aadhaarDisplay(aadhaar: unknown): string {
  const digits = String(aadhaar ?? '').replace(/\D/g, '')
  if (digits.length >= 4) return digits.slice(-4)
  return String(aadhaar ?? '').trim()
}

function pickDbFirst(dbVal: unknown, excelVal: unknown): string {
  const d = dbVal === null || dbVal === undefined ? '' : String(dbVal).trim()
  if (d) return d
  return excelVal === null || excelVal === undefined ? '' : String(excelVal).trim()
}

function formatEmploymentType(value: unknown): string {
  const v = String(value ?? '').trim()
  if (!v) return ''
  if (v.toLowerCase() === 'full-time') return 'Full Time'
  return v
}

function leaveRemaining(
  balances: Record<string, { remaining: number }>,
  type: string
): string {
  const b = balances[type]
  if (!b) return ''
  return String(b.remaining)
}

/**
 * Overlay HRMS employee profile + live leave balances onto the payroll Excel row.
 * Payroll amounts (Basic, HRA, etc.) stay from Excel; identity/statutory/leave come from DB when found.
 */
export async function enrichPayrollEmployeeFromDb(excelEmp: Employee): Promise<Employee> {
  const emp: Employee = { ...excelEmp }
  const payrollEmpId = String(emp['Emp ID'] ?? '').trim()
  if (!payrollEmpId) return emp

  const db = await findEmployeeByPayrollEmpId(payrollEmpId)
  if (!db) return emp

  const fullName = [db.firstName, db.middleName, db.lastName].filter(Boolean).join(' ').trim()

  let reportingTo = String(emp['Reporting To'] ?? '').trim()
  if (db.managerId) {
    const mgr = await getDB().collection('employees').findOne({ id: db.managerId })
    if (mgr) {
      reportingTo = `${mgr.firstName || ''} ${mgr.lastName || ''}`.trim()
    }
  }

  let balances: Record<string, { remaining: number }> = {}
  try {
    balances = (await getLeaveBalances(String(db.id))) as Record<string, { remaining: number }>
  } catch {
    /* leave module optional at generation time */
  }

  emp['Emp ID'] = pickDbFirst(db.employeeId, emp['Emp ID'])
  emp['Name'] = pickDbFirst(fullName, emp['Name'])
  emp['Date of Birth'] = pickDbFirst(formatPayslipDate(db.dob), emp['Date of Birth'])
  emp['Date of Joining'] = pickDbFirst(formatPayslipDate(db.joinedAt), emp['Date of Joining'])
  emp['Designation'] = pickDbFirst(db.designation, emp['Designation'])
  emp['Department'] = pickDbFirst(db.role, emp['Department'])
  emp['Grade'] = pickDbFirst(db.salaryGrade, emp['Grade'])
  if (reportingTo) emp['Reporting To'] = reportingTo
  emp['Employment Type'] = pickDbFirst(formatEmploymentType(db.employmentType), emp['Employment Type'])

  emp['PAN'] = pickDbFirst(db.pan, emp['PAN'])
  emp['Aadhaar'] = pickDbFirst(aadhaarDisplay(db.aadhaar), emp['Aadhaar'])
  emp['Aadhaar (last 4)'] = emp['Aadhaar']
  emp['UAN'] = pickDbFirst(db.uan, emp['UAN'])
  emp['PF UAN'] = pickDbFirst(db.uan, emp['PF UAN'])
  emp['A/C No'] = pickDbFirst(db.accountNumber, emp['A/C No'])
  emp['Account Number'] = emp['A/C No']
  emp['Bank'] = pickDbFirst(db.bankName, emp['Bank'])
  emp['Bank Name'] = pickDbFirst(db.bankName, emp['Bank Name'])
  emp['IFSC'] = pickDbFirst(db.ifsc, emp['IFSC'])
  emp['IFSC / Mode'] = pickDbFirst(db.ifsc, emp['IFSC / Mode'])
  if (!emp['Payment Mode']) emp['Payment Mode'] = 'NEFT'
  emp['Phone'] = pickDbFirst(db.phone, emp['Phone'])

  const el = leaveRemaining(balances, 'Earned Leave')
  const cl = leaveRemaining(balances, 'Casual Leave')
  const sl = leaveRemaining(balances, 'Sick Leave')

  if (el) {
    emp['EL Balance'] = el
    emp['Earned Leave'] = el
  }
  if (cl) {
    emp['CL Balance'] = cl
    emp['Casual Leave'] = cl
  }
  if (sl) {
    emp['SL Balance'] = sl
    emp['Sick Leave'] = sl
  }

  return emp
}
