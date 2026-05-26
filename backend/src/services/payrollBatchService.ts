import { mkdirSync, writeFileSync, existsSync, readFileSync, unlinkSync, rmSync } from 'fs'
import { join, resolve } from 'path'
import { randomUUID } from 'crypto'
import { PDFDocument } from 'pdf-lib'
import { getDB } from '../config/db'
import { PAYROLL_UPLOADS_ROOT } from '../config/paths'
import {
  readMasterExcelFromBuffer,
  type SalaryStructure,
  type Employee,
  type Company,
} from './payslipGenerator'
import { savePayslipAsPdf, type TemplateId } from './payslipPdfGenerator'
import {
  listSentFlagsForBatch,
  removeSentPayslip,
  sendPayslipToEmployee,
} from './employeePayslipService'
import { prepareEmployeeForPayslip } from './payrollYtdService'

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
  /** Parsed from salary_structure sheet at upload — used when generating PDFs. */
  salaryStructure?: SalaryStructure
}

const UPLOADS_ROOT = PAYROLL_UPLOADS_ROOT

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
  const { company, structure, employees } = await readMasterExcelFromBuffer(buffer)

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
      const fileName = payslipFileNameForEmpId(empId)
      const prepared = await prepareEmployeeForPayslip(company, structure, emp, id)
      await savePayslipAsPdf(company, structure, prepared, join(payslipsDir, fileName), templateId)
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
    salaryStructure: structure,
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

export function payslipFileNameForEmpId(empId: string): string {
  return `Payslip_${String(empId).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
}

/** Resolve payslip path; always rebuild PDF from batch Excel so structure sheet changes apply. */
export async function ensurePayslipPdfExists(batchId: string, fileName: string): Promise<string> {
  const safeName = safePayslipFileName(fileName)
  const filePath = join(getPayslipsDir(batchId), safeName)
  if (existsSync(filePath)) {
    try {
      unlinkSync(filePath)
    } catch {
      /* ignore */
    }
  }

  const batch = await batchesCollection().findOne({ id: batchId })
  if (!batch) {
    throw new Error('Payroll batch not found')
  }

  const hasRecord = batch.results.some((r) => r.status === 'success' && r.fileName === safeName)
  if (!hasRecord) {
    throw new Error('Payslip file not found')
  }

  let buffer: Buffer
  try {
    buffer = readBatchExcel(batchId)
  } catch {
    throw new Error(
      'Payslip PDF is missing and the payroll Excel for this batch is no longer available. Re-upload the payroll file to regenerate payslips.'
    )
  }

  const rawBatch = await batchesCollection().findOne({ id: batchId })
  const parsed = await readMasterExcelFromBuffer(buffer)

  let structure: SalaryStructure = parsed.structure
  if (Object.keys(structure).length === 0 && rawBatch?.salaryStructure) {
    structure = rawBatch.salaryStructure
  }

  const company: Company = parsed.company
  const emp: Employee | undefined = parsed.employees.find(
    (e) => payslipFileNameForEmpId(String(e['Emp ID'] || '')) === safeName
  )

  if (!emp) {
    throw new Error('Employee not found in payroll file for this payslip')
  }
  if (!structure || Object.keys(structure).length === 0) {
    throw new Error('Salary structure missing for this batch. Re-upload the payroll Excel file.')
  }

  const templateId = (batch.templateId as TemplateId) || 'classic'
  ensureBatchDirs(batchId)
  const prepared = await prepareEmployeeForPayslip(company, structure, emp, batchId)
  await savePayslipAsPdf(company, structure, prepared, filePath, templateId)
  return resolve(filePath)
}

/** Merge all generated payslip PDFs in a batch into a single document. */
export async function mergeBatchPayslipPdfs(batchId: string): Promise<Buffer> {
  const batch = await getPayrollBatch(batchId)
  if (!batch) {
    throw new Error('Payroll batch not found')
  }

  const fileNames = batch.results
    .filter((r) => r.status === 'success' && r.fileName)
    .map((r) => r.fileName!)

  if (fileNames.length === 0) {
    throw new Error('No payslip PDFs to merge')
  }

  const mergedPdf = await PDFDocument.create()

  for (const fileName of fileNames) {
    const filePath = getPayslipFilePath(batchId, fileName)
    if (!existsSync(filePath)) continue

    const bytes = readFileSync(filePath)
    const pdf = await PDFDocument.load(bytes)
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
    for (const page of pages) {
      mergedPdf.addPage(page)
    }
  }

  if (mergedPdf.getPageCount() === 0) {
    throw new Error('No payslip PDF files found on disk')
  }

  return Buffer.from(await mergedPdf.save())
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
