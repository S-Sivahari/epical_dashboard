import { randomUUID } from 'crypto'
import { getDB } from '../config/db'
import type { Company } from './payslipGenerator'
import { parsePayPeriodFromCompany } from './payrollYtdService'
import {
  getEmployeeOfficialEmail,
  getPayslipEmailCandidates,
  resolveEmployeeForAuthUser,
} from '../utils/employeeAuth'

export interface EmployeePayslipRecord {
  id: string
  employeeId: string
  employeeEmail: string
  employeeDbId: string
  employeeName: string
  batchId: string
  fileName: string
  payMonth: string
  /** Normalized period key e.g. 2026-04 — one dashboard entry per employee per period */
  payPeriodKey?: string
  /** Take-home pay for the period (matches payslip PDF net pay). */
  netSalary?: number
  sentAt: Date
}

export function resolvePayPeriodKey(payPeriodKey?: string, payMonth?: string): string | null {
  const key = payPeriodKey?.trim()
  if (key) return key
  const label = payMonth?.trim()
  if (!label) return null
  const period = parsePayPeriodFromCompany({ 'Pay Month': label } as Company)
  return `${period.year}-${String(period.month).padStart(2, '0')}`
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
  payPeriodKey?: string
  employeeDbId?: string
  netSalary?: number
}): Promise<{ record: EmployeePayslipRecord; replaced: boolean }> {
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

  const employeeEmail = getEmployeeOfficialEmail(employee as any)
  if (!employeeEmail) {
    throw new Error('Employee has no email on file — cannot deliver payslip to dashboard')
  }

  const employeeDbId = String(employee.id)
  const payMonth = params.payMonth || 'Payslip'
  const periodKey = resolvePayPeriodKey(params.payPeriodKey, payMonth)

  let netSalary = params.netSalary
  if (netSalary == null) {
    try {
      const { resolveNetPayForBatchPayslip } = await import('./payslipNetPayResolver')
      const resolved = await resolveNetPayForBatchPayslip(params.batchId, params.empId)
      if (resolved != null) netSalary = resolved
    } catch {
      /* optional */
    }
  }

  let existing: EmployeePayslipRecord | null = await payslipsCollection().findOne({
    batchId: params.batchId,
    fileName: params.fileName,
  })

  const record: EmployeePayslipRecord = {
    id: existing?.id ?? randomUUID(),
    employeeId: String(employee.employeeId || params.empId),
    employeeEmail,
    employeeDbId,
    employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
    batchId: params.batchId,
    fileName: params.fileName,
    payMonth,
    payPeriodKey: periodKey ?? undefined,
    netSalary,
    sentAt: new Date(),
  }

  await payslipsCollection().updateOne(
    { batchId: params.batchId, fileName: params.fileName },
    { $set: record },
    { upsert: true }
  )

  return { record, replaced: !!existing }
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

function payslipPeriodKey(doc: EmployeePayslipRecord): string {
  if (doc.batchId && doc.payPeriodKey) return `${doc.batchId}|${doc.payPeriodKey}`
  if (doc.payPeriodKey) return doc.payPeriodKey
  const fromLabel = resolvePayPeriodKey(undefined, doc.payMonth)
  if (fromLabel) return `${doc.batchId}|${fromLabel}`
  return `${doc.batchId}:${doc.fileName}`
}

async function enrichRecordWithNetPay(doc: EmployeePayslipRecord): Promise<EmployeePayslipRecord> {
  if (doc.netSalary != null && !Number.isNaN(doc.netSalary)) return doc
  try {
    const { resolveNetPayForBatchPayslip } = await import('./payslipNetPayResolver')
    const net = await resolveNetPayForBatchPayslip(doc.batchId, doc.employeeId)
    if (net == null) return doc
    return { ...doc, netSalary: net }
  } catch {
    return doc
  }
}

async function payslipAccessOrClauses(
  userId: string,
  email?: string
): Promise<Record<string, unknown>[]> {
  const employee = await resolveEmployeeForAuthUser(userId, email)
  const candidates = await getPayslipEmailCandidates(userId, email)
  const clauses: Record<string, unknown>[] = []
  if (candidates.length) {
    clauses.push({ employeeEmail: { $in: candidates } })
  }
  if (employee?.id) {
    clauses.push({ employeeDbId: String(employee.id) })
  }
  return clauses
}

function dedupePayslipRecords(all: EmployeePayslipRecord[]): EmployeePayslipRecord[] {
  const byPeriod = new Map<string, EmployeePayslipRecord>()
  for (const doc of all) {
    const key = payslipPeriodKey(doc)
    const prev = byPeriod.get(key)
    if (!prev || new Date(doc.sentAt).getTime() > new Date(prev.sentAt).getTime()) {
      byPeriod.set(key, doc)
    }
  }

  return [...byPeriod.values()].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
  )
}

export async function getPayslipsForAuthUser(
  userId: string,
  email?: string
): Promise<EmployeePayslipRecord[]> {
  const orClauses = await payslipAccessOrClauses(userId, email)
  if (!orClauses.length) return []

  const all = await payslipsCollection()
    .find({ $or: orClauses })
    .sort({ sentAt: -1 })
    .toArray()

  const deduped = dedupePayslipRecords(all)
  return Promise.all(deduped.map((doc) => enrichRecordWithNetPay(doc)))
}

/** @deprecated Use getPayslipsForAuthUser — kept for scripts/tests. */
export async function getPayslipsForEmployeeEmail(email: string): Promise<EmployeePayslipRecord[]> {
  const all = await payslipsCollection()
    .find({ employeeEmail: email.toLowerCase().trim() })
    .sort({ sentAt: -1 })
    .toArray()

  const deduped = dedupePayslipRecords(all)
  return Promise.all(deduped.map((doc) => enrichRecordWithNetPay(doc)))
}

/** Remove duplicate dashboard rows (keeps latest per employee + pay period). */
export async function dedupeEmployeePayslips(): Promise<number> {
  const all = await payslipsCollection().find({}).sort({ sentAt: -1 }).toArray()
  const keepIds = new Set<string>()
  const seen = new Set<string>()

  for (const doc of all) {
    const groupKey = `${doc.employeeDbId || doc.employeeEmail}|${payslipPeriodKey(doc)}`
    if (seen.has(groupKey)) continue
    seen.add(groupKey)
    keepIds.add(doc.id)
  }

  if (keepIds.size === all.length) return 0

  const result = await payslipsCollection().deleteMany({ id: { $nin: [...keepIds] } })
  return result.deletedCount
}

export async function ensureEmployeePayslipIndexes(): Promise<number> {
  const col = payslipsCollection()
  
  // Try to create indexes, but if they already exist with different options, skip
  try {
    await col.createIndex({ employeeDbId: 1, payPeriodKey: 1 })
  } catch (err: any) {
    if (err.code !== 86) throw err // Ignore IndexKeySpecsConflict
  }
  
  try {
    await col.createIndex({ employeeEmail: 1, payPeriodKey: 1 })
  } catch (err: any) {
    if (err.code !== 86) throw err
  }
  
  try {
    // Match the existing unique index
    await col.createIndex({ batchId: 1, fileName: 1 }, { unique: true })
  } catch (err: any) {
    if (err.code !== 86) throw err
  }
  
  return dedupeEmployeePayslips()
}

export async function removeSentPayslip(batchId: string, fileName: string): Promise<void> {
  await payslipsCollection().deleteOne({ batchId, fileName })
}

/** After batch regenerate — admin must Send again to publish updated PDFs. */
export async function clearSentPayslipsForBatch(batchId: string): Promise<void> {
  await payslipsCollection().deleteMany({ batchId })
}

export async function getPayslipByIdForEmployee(
  payslipId: string,
  userId: string,
  email?: string
): Promise<EmployeePayslipRecord | null> {
  const orClauses = await payslipAccessOrClauses(userId, email)
  if (!orClauses.length) return null

  return payslipsCollection().findOne({
    id: payslipId,
    $or: orClauses,
  })
}

/** Safe fields for employee dashboard — no salary figures or PDF access hints. */
export function toEmployeePayslipSummary(record: EmployeePayslipRecord) {
  return {
    id: record.id,
    employeeId: record.employeeId,
    payMonth: record.payMonth,
    payPeriodKey: record.payPeriodKey,
    fileName: record.fileName,
    sentAt: record.sentAt,
    employeeName: record.employeeName,
  }
}

export async function resendPayslipEmailToEmployee(
  payslipId: string,
  userId: string,
  email?: string
): Promise<{ sentTo: string }> {
  const record = await getPayslipByIdForEmployee(payslipId, userId, email)
  if (!record) {
    throw new Error('Payslip not found')
  }

  const recipientEmail = record.employeeEmail?.trim()
  if (!recipientEmail) {
    throw new Error('No email on file for this payslip')
  }

  const { readFileSync } = await import('fs')
  const { sendPayslipEmail } = await import('./emailService')
  const { ensurePayslipPdfExists } = await import('./payrollBatchService')
  const { formatPayslipDownloadFileName } = await import('./payslipDownloadName')

  let attachment: import('./emailService').EmailAttachment | undefined

  try {
    const pdfBuffer = await ensurePayslipPdfExists(record.batchId, record.fileName)
    attachment = {
      filename: formatPayslipDownloadFileName(
        record.employeeName,
        record.payMonth,
        record.payPeriodKey
      ),
      content: pdfBuffer,
      contentType: 'application/pdf',
    }
  } catch (error) {
    console.warn('[Payslip Service] Could not attach payslip PDF for resend:', error)
  }

  const sent = await sendPayslipEmail(
    {
      recipientEmail,
      recipientName: record.employeeName,
      employeeName: record.employeeName,
      employeeId: record.employeeId,
      payMonth: record.payMonth,
      fileName: record.fileName,
    },
    undefined,
    attachment
  )

  if (!sent) {
    throw new Error('Failed to send payslip email')
  }

  return { sentTo: recipientEmail }
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
