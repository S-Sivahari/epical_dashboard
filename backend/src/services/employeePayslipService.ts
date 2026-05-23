import { randomUUID } from 'crypto'
import { getDB } from '../config/db'
export interface EmployeePayslipRecord {
  id: string
  employeeId: string
  employeeEmail: string
  employeeDbId: string
  employeeName: string
  batchId: string
  fileName: string
  payMonth: string
  sentAt: Date
}

function payslipsCollection() {
  return getDB().collection<EmployeePayslipRecord>('employee_payslips')
}

function getEmployeeCollectionSync() {
  return getDB().collection('employees')
}

export async function findEmployeeByPayrollEmpId(empId: string) {
  const col = getEmployeeCollectionSync()
  const normalized = empId.trim().toUpperCase()
  return col.findOne({
    $or: [
      { employeeId: normalized },
      { employeeId: empId.trim() },
      { id: empId.trim() },
    ],
  })
}

export async function sendPayslipToEmployee(params: {
  batchId: string
  fileName: string
  empId: string
  payMonth?: string
  employeeDbId?: string
}): Promise<EmployeePayslipRecord> {
  const col = getEmployeeCollectionSync()
  let employee = null

  if (params.employeeDbId) {
    employee = await col.findOne({ id: params.employeeDbId })
  }
  if (!employee) {
    employee = await findEmployeeByPayrollEmpId(params.empId)
  }
  if (!employee) {
    throw new Error(
      `No employee found with ID "${params.empId}". Add this employee in HR first, or match Emp ID in the payroll file to their Employee ID.`
    )
  }

  const employeeEmail = String(employee.email || '').toLowerCase()
  if (!employeeEmail) {
    throw new Error('Employee has no email on file — cannot deliver payslip to dashboard')
  }

  const record: EmployeePayslipRecord = {
    id: randomUUID(),
    employeeId: String(employee.employeeId || params.empId),
    employeeEmail,
    employeeDbId: String(employee.id),
    employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
    batchId: params.batchId,
    fileName: params.fileName,
    payMonth: params.payMonth || 'Payslip',
    sentAt: new Date(),
  }

  await payslipsCollection().updateOne(
    { batchId: params.batchId, fileName: params.fileName },
    { $set: record },
    { upsert: true }
  )

  return record
}

export async function isPayslipSent(batchId: string, fileName: string): Promise<boolean> {
  const doc = await payslipsCollection().findOne({ batchId, fileName })
  return !!doc
}

export async function listSentFlagsForBatch(
  batchId: string
): Promise<Record<string, boolean>> {
  const docs = await payslipsCollection().find({ batchId }).toArray()
  const flags: Record<string, boolean> = {}
  for (const d of docs) {
    if (d.fileName) flags[d.fileName] = true
  }
  return flags
}

export async function getPayslipsForEmployeeEmail(email: string): Promise<EmployeePayslipRecord[]> {
  return payslipsCollection()
    .find({ employeeEmail: email.toLowerCase().trim() })
    .sort({ sentAt: -1 })
    .toArray()
}

export async function removeSentPayslip(batchId: string, fileName: string): Promise<void> {
  await payslipsCollection().deleteOne({ batchId, fileName })
}

export async function getPayslipByIdForEmployee(
  payslipId: string,
  email: string
): Promise<EmployeePayslipRecord | null> {
  return payslipsCollection().findOne({
    id: payslipId,
    employeeEmail: email.toLowerCase().trim(),
  })
}

export async function getAllSentPayslips(limit = 100): Promise<EmployeePayslipRecord[]> {
  return payslipsCollection()
    .find({})
    .sort({ sentAt: -1 })
    .limit(limit)
    .toArray()
}

export async function getSentCountsByBatch(): Promise<Record<string, number>> {
  const docs = await payslipsCollection().find({}).toArray()
  const counts: Record<string, number> = {}
  for (const d of docs) {
    counts[d.batchId] = (counts[d.batchId] || 0) + 1
  }
  return counts
}
