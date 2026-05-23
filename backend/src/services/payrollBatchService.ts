import { mkdirSync, writeFileSync, existsSync, readFileSync, unlinkSync, rmSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { getDB } from '../config/db'
import { readMasterExcelFromBuffer } from './payslipGenerator'
import { savePayslipAsPdf, type TemplateId } from './payslipPdfGenerator'
import {
  listSentFlagsForBatch,
  removeSentPayslip,
  sendPayslipToEmployee,
} from './employeePayslipService'

export interface PayslipResult {
  empId: string
  name: string
  status: 'success' | 'error'
  fileName?: string
  error?: string
  sent?: boolean
  sentAt?: Date
}

export interface PayrollBatch {
  id: string
  originalFileName: string
  uploadedAt: Date
  payMonth?: string
  templateId?: string
  employeeCount: number
  totalGenerated: number
  totalFailed: number
  totalSent?: number
  results: PayslipResult[]
}

const UPLOADS_ROOT = join(process.cwd(), 'uploads', 'payroll')

function batchesCollection() {
  return getDB().collection<PayrollBatch>('payroll_batches')
}

export function getBatchDir(batchId: string): string {
  return join(UPLOADS_ROOT, batchId)
}

export function getExcelPath(batchId: string): string {
  return join(getBatchDir(batchId), 'payroll.xlsx')
}

export function getPayslipsDir(batchId: string): string {
  return join(getBatchDir(batchId), 'payslips')
}

export function ensureBatchDirs(batchId: string): void {
  const dir = getBatchDir(batchId)
  const payslipsDir = getPayslipsDir(batchId)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  if (!existsSync(payslipsDir)) mkdirSync(payslipsDir, { recursive: true })
}

/** Upload Excel, generate per-employee PDF payslips, persist batch metadata. */
export async function processPayrollUpload(
  buffer: Buffer,
  originalFileName: string,
  templateId: TemplateId = 'classic'
): Promise<PayrollBatch> {
  const { company, structure, employees } = readMasterExcelFromBuffer(buffer)

  if (employees.length === 0) {
    throw new Error(
      'No employees found. Use the demo template (employee, company, salary structure, readme sheets) or an Excel file with an employee sheet starting at row 4 with Emp ID column.'
    )
  }

  const id = randomUUID()
  ensureBatchDirs(id)
  writeFileSync(getExcelPath(id), buffer)

  const results: PayslipResult[] = []
  const payslipsDir = getPayslipsDir(id)

  for (const emp of employees) {
    const empId = String(emp['Emp ID'] || 'Unknown')
    const name = String(emp['Name'] || '')
    try {
      const fileName = `Payslip_${empId.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
      await savePayslipAsPdf(company, structure, emp, join(payslipsDir, fileName), templateId)
      results.push({ empId, name, status: 'success', fileName })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Generation failed'
      results.push({ empId, name, status: 'error', error: message })
    }
  }

  const batch: PayrollBatch = {
    id,
    originalFileName,
    uploadedAt: new Date(),
    payMonth: String(company['Pay Month'] || ''),
    templateId,
    employeeCount: employees.length,
    totalGenerated: results.filter((r) => r.status === 'success').length,
    totalFailed: results.filter((r) => r.status === 'error').length,
    results,
  }

  await batchesCollection().insertOne(batch)
  return enrichBatchWithSentStatus(batch)
}

export async function enrichBatchWithSentStatus(batch: PayrollBatch): Promise<PayrollBatch> {
  const flags = await listSentFlagsForBatch(batch.id)
  const results = batch.results.map((r) => ({
    ...r,
    sent: r.fileName ? !!flags[r.fileName] : false,
  }))
  const totalSent = results.filter((r) => r.sent).length
  return { ...batch, results, totalSent }
}

export async function getPayrollBatch(batchId: string): Promise<PayrollBatch | null> {
  const batch = await batchesCollection().findOne({ id: batchId })
  if (!batch) return null
  return enrichBatchWithSentStatus(batch)
}

export async function getLatestPayrollBatch(): Promise<PayrollBatch | null> {
  const batches = await batchesCollection()
    .find({})
    .sort({ uploadedAt: -1 })
    .limit(1)
    .toArray()
  const batch = batches[0]
  if (!batch) return null
  return enrichBatchWithSentStatus(batch)
}

export async function listPayrollBatches(limit = 20): Promise<PayrollBatch[]> {
  const raw = await batchesCollection().find({}).sort({ uploadedAt: -1 }).limit(limit).toArray()
  return Promise.all(raw.map((b) => enrichBatchWithSentStatus(b)))
}

export function readBatchExcel(batchId: string): Buffer {
  const path = getExcelPath(batchId)
  if (!existsSync(path)) {
    throw new Error('Payroll file not found for this batch')
  }
  return readFileSync(path)
}

export async function sendAllPayslipsInBatch(
  batchId: string,
  employeeDbIdByEmpId: Record<string, string> = {}
): Promise<{
  batch: PayrollBatch
  sent: number
  skipped: number
  failed: { empId: string; name: string; error: string }[]
}> {
  const raw = await batchesCollection().findOne({ id: batchId })
  if (!raw) {
    throw new Error('Payroll batch not found')
  }

  const flags = await listSentFlagsForBatch(batchId)
  const toSend = raw.results.filter(
    (r) => r.status === 'success' && r.fileName && !flags[r.fileName]
  )

  let sent = 0
  const failed: { empId: string; name: string; error: string }[] = []

  for (const r of toSend) {
    if (!r.fileName) continue
    try {
      await sendPayslipToEmployee({
        batchId,
        fileName: r.fileName,
        empId: r.empId,
        payMonth: raw.payMonth,
        employeeDbId: employeeDbIdByEmpId[r.empId],
      })
      sent++
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Send failed'
      failed.push({ empId: r.empId, name: r.name, error: message })
    }
  }

  const skipped = raw.results.filter(
    (r) => r.status === 'success' && r.fileName && flags[r.fileName]
  ).length

  const batch = await enrichBatchWithSentStatus(raw)
  return { batch, sent, skipped, failed }
}

export function getPayslipFilePath(batchId: string, fileName: string): string {
  return join(getPayslipsDir(batchId), safePayslipFileName(fileName))
}

export function safePayslipFileName(fileName: string): string {
  const base = fileName.replace(/[/\\]/g, '').trim()
  if (!/^Payslip_[a-zA-Z0-9_-]+\.pdf$/i.test(base)) {
    throw new Error('Invalid payslip file name')
  }
  return base
}

/** Remove uploaded Excel, all payslip PDFs, and batch record. */
export async function deletePayrollBatch(batchId: string): Promise<void> {
  const batch = await getPayrollBatch(batchId)
  if (!batch) {
    throw new Error('Payroll batch not found')
  }

  const dir = getBatchDir(batchId)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true })
  }

  await batchesCollection().deleteOne({ id: batchId })
  await getDB().collection('employee_payslips').deleteMany({ batchId })
}

/** Remove one payslip PDF and update batch metadata. */
export async function deletePayslipFromBatch(
  batchId: string,
  fileName: string
): Promise<PayrollBatch> {
  const batch = await getPayrollBatch(batchId)
  if (!batch) {
    throw new Error('Payroll batch not found')
  }

  const safeName = safePayslipFileName(fileName)
  const filePath = join(getPayslipsDir(batchId), safeName)
  if (existsSync(filePath)) {
    unlinkSync(filePath)
  }
  await removeSentPayslip(batchId, safeName)

  const results = batch.results.map((r) =>
    r.fileName === safeName
      ? { ...r, status: 'error' as const, fileName: undefined, error: 'Payslip deleted' }
      : r
  )

  const totalGenerated = results.filter((r) => r.status === 'success').length
  const totalFailed = results.filter((r) => r.status === 'error').length

  const updated: PayrollBatch = {
    ...batch,
    results,
    totalGenerated,
    totalFailed,
  }

  await batchesCollection().updateOne(
    { id: batchId },
    { $set: { results, totalGenerated, totalFailed } }
  )

  return enrichBatchWithSentStatus(updated)
}
