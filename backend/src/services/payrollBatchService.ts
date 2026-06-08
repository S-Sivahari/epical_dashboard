import { mkdirSync, writeFileSync, existsSync, readFileSync, unlinkSync, rmSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { randomUUID } from 'crypto'
import ExcelJS from 'exceljs'
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
  clearSentPayslipsForBatch,
  removeSentPayslip,
  sendPayslipToEmployee,
} from './employeePayslipService'
import { parsePayPeriodFromCompany, prepareEmployeeForPayslip } from './payrollYtdService'
import type { EmployeePayslipRecord } from './employeePayslipService'
import {
  upsertPayslipPdf,
  getPayslipPdfBuffer,
  deletePayslipPdf,
  deletePayslipsForBatch,
  upsertPayslipPdfFromFileIfMissing,
} from './payslipStorageService'

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
  /** Normalized period key e.g. 2026-04 for duplicate detection */
  payPeriodKey?: string
  payYear?: number
  payMonthNum?: number
  templateId?: string
  employeeCount: number
  totalGenerated: number
  totalFailed: number
  totalSent?: number
  results: PayslipResult[]
  /** Parsed from salary_structure sheet at upload — used when generating PDFs. */
  salaryStructure?: SalaryStructure
}

export interface PayrollUploadOptions {
  replaceBatchId?: string
  /** Merge new employees into an existing batch for the same pay period. */
  appendToBatchId?: string
  resendPayslips?: boolean
  employeeDbIdByEmpId?: Record<string, string>
}

const CALENDAR_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export function buildPayPeriodFieldsFromCalendar(
  year: number,
  month: number
): {
  payMonth: string
  payPeriodKey: string
  payYear: number
  payMonthNum: number
} {
  const safeMonth = Math.min(12, Math.max(1, month))
  const payMonth = `${CALENDAR_MONTH_NAMES[safeMonth - 1]} ${year}`
  const payPeriodKey = `${year}-${String(safeMonth).padStart(2, '0')}`
  return {
    payMonth,
    payPeriodKey,
    payYear: year,
    payMonthNum: safeMonth,
  }
}

export interface PayrollUploadResult {
  batch: PayrollBatch
  replaced: boolean
  appended?: boolean
  addedCount?: number
  resent: EmployeePayslipRecord[]
}

export function buildPayPeriodFields(company: Company): {
  payMonth: string
  payPeriodKey: string
  payYear: number
  payMonthNum: number
} {
  const period = parsePayPeriodFromCompany(company)
  const payMonth = period.label
  const payPeriodKey = `${period.year}-${String(period.month).padStart(2, '0')}`
  return {
    payMonth,
    payPeriodKey,
    payYear: period.year,
    payMonthNum: period.month,
  }
}

export function batchPayPeriodKey(batch: PayrollBatch): string | null {
  if (batch.payPeriodKey) return batch.payPeriodKey
  if (!batch.payMonth) return null
  return buildPayPeriodFields({ 'Pay Month': batch.payMonth } as Company).payPeriodKey
}

/** Find existing batch for the same calendar month/year (newest first). */
export async function findBatchByPayPeriod(company: Company): Promise<PayrollBatch | null> {
  const { payPeriodKey } = buildPayPeriodFields(company)
  return findBatchByPayPeriodKey(payPeriodKey)
}

export async function findBatchByPayPeriodKey(payPeriodKey: string): Promise<PayrollBatch | null> {
  const key = payPeriodKey.trim()
  if (!key) return null
  const batches = await batchesCollection().find({}).sort({ uploadedAt: -1 }).toArray()
  for (const b of batches) {
    if (batchPayPeriodKey(b) === key) return b
  }
  return null
}

function normalizePayrollEmpId(value: unknown): string {
  return String(value ?? '').trim().toUpperCase()
}

export function collectBatchEmpIds(batch: PayrollBatch): Set<string> {
  return new Set(
    batch.results.map((r) => normalizePayrollEmpId(r.empId)).filter(Boolean),
  )
}

/** Emp IDs present in both the existing batch and a new upload. */
export function findOverlappingEmpIds(
  existing: PayrollBatch,
  employees: Employee[],
): string[] {
  const existingIds = collectBatchEmpIds(existing)
  const overlap: string[] = []
  for (const emp of employees) {
    const id = normalizePayrollEmpId(emp['Emp ID'])
    if (id && existingIds.has(id)) {
      overlap.push(String(emp['Emp ID']))
    }
  }
  return overlap
}

function findEmployeeWorksheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  return (
    wb.getWorksheet('employee') ??
    wb.worksheets.find((w) => w.name.trim().toLowerCase() === 'employee') ??
    wb.worksheets.find((w) => w.name.toLowerCase().includes('employee'))
  )
}

async function appendEmployeesToStoredExcel(batchId: string, newBuffer: Buffer): Promise<void> {
  const excelPath = getExcelPath(batchId)
  if (!existsSync(excelPath)) {
    writeFileSync(excelPath, newBuffer)
    return
  }

  const existingBuffer = readFileSync(excelPath)
  const { employees: newEmployees } = await readMasterExcelFromBuffer(newBuffer)
  const { employees: existingEmployees } = await readMasterExcelFromBuffer(existingBuffer)
  const existingIds = new Set(
    existingEmployees.map((e) => normalizePayrollEmpId(e['Emp ID'])).filter(Boolean),
  )

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(existingBuffer as ExcelJS.Buffer)
  const sheet = findEmployeeWorksheet(wb)
  if (!sheet) {
    writeFileSync(excelPath, newBuffer)
    return
  }

  let headerRowNum = 4
  sheet.eachRow((row, rowNumber) => {
    if (String(row.getCell(1).value ?? '').trim().toLowerCase() === 'emp id') {
      headerRowNum = rowNumber
    }
  })

  const headers: string[] = []
  sheet.getRow(headerRowNum).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? '').trim()
  })

  for (const emp of newEmployees) {
    const id = normalizePayrollEmpId(emp['Emp ID'])
    if (!id || existingIds.has(id)) continue
    const rowData = headers.map((h) => (h ? (emp[h] ?? '') : ''))
    sheet.addRow(rowData)
    existingIds.add(id)
  }

  writeFileSync(excelPath, Buffer.from(await wb.xlsx.writeBuffer()))
}

function clearPayslipPdfFiles(batchId: string): void {
  const payslipsDir = getPayslipsDir(batchId)
  if (!existsSync(payslipsDir)) return
  for (const name of readdirSync(payslipsDir)) {
    if (name.toLowerCase().endsWith('.pdf')) {
      try {
        unlinkSync(join(payslipsDir, name))
      } catch {
        /* ignore */
      }
    }
  }
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
  templateId: TemplateId = 'classic',
  options: PayrollUploadOptions = {}
): Promise<PayrollUploadResult> {
  const { company: companyFromFile, structure, employees } = await readMasterExcelFromBuffer(buffer)

  if (employees.length === 0) {
    throw new Error(
      'No employees found. Use the demo template (employee, company, salary structure, readme sheets) or an Excel file with an employee sheet starting at row 4 with Emp ID column.'
    )
  }

  const company = companyFromFile
  const periodFields = buildPayPeriodFields(company)
  const appendBatchId = options.appendToBatchId?.trim()
  const replaceBatchId = options.replaceBatchId?.trim()

  if (appendBatchId && replaceBatchId) {
    throw new Error('Cannot append and replace in the same upload')
  }

  if (appendBatchId) {
    const existing = await batchesCollection().findOne({ id: appendBatchId })
    if (!existing) {
      throw new Error('Payroll batch to append to was not found')
    }

    const existingIds = collectBatchEmpIds(existing)
    const employeesToAdd = employees.filter((emp) => {
      const id = normalizePayrollEmpId(emp['Emp ID'])
      return id && !existingIds.has(id)
    })

    if (employeesToAdd.length === 0) {
      throw new Error('All employees in this file are already in the payroll batch for this month')
    }

    const overlap = findOverlappingEmpIds(existing, employees)
    if (overlap.length > 0) {
      throw new Error(
        `Employee ID(s) already in this pay period: ${overlap.slice(0, 5).join(', ')}${overlap.length > 5 ? '…' : ''}`,
      )
    }

    ensureBatchDirs(appendBatchId)
    await appendEmployeesToStoredExcel(appendBatchId, buffer)

    const payslipsDir = getPayslipsDir(appendBatchId)
    const newResults: PayslipResult[] = []

    for (const emp of employeesToAdd) {
      const empId = String(emp['Emp ID'] || 'Unknown')
      const name = String(emp['Name'] || '')
      try {
        const fileName = payslipFileNameForEmpId(empId)
        const prepared = await prepareEmployeeForPayslip(company, structure, emp, appendBatchId)
        const filePath = join(payslipsDir, fileName)
        await savePayslipAsPdf(company, structure, prepared, filePath, templateId)
        await upsertPayslipPdf({
          batchId: appendBatchId,
          fileName,
          empId,
          payPeriodKey: periodFields.payPeriodKey,
          pdfBuffer: readFileSync(filePath),
        })
        newResults.push({ empId, name, status: 'success', fileName })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Generation failed'
        newResults.push({ empId, name, status: 'error', error: message })
      }
    }

    const mergedResults = [...existing.results, ...newResults]
    const batchDoc: PayrollBatch = {
      ...existing,
      originalFileName: `${existing.originalFileName} + ${originalFileName}`,
      uploadedAt: new Date(),
      payMonth: periodFields.payMonth,
      payPeriodKey: periodFields.payPeriodKey,
      payYear: periodFields.payYear,
      payMonthNum: periodFields.payMonthNum,
      templateId,
      employeeCount: mergedResults.length,
      totalGenerated: mergedResults.filter((r) => r.status === 'success').length,
      totalFailed: mergedResults.filter((r) => r.status === 'error').length,
      results: mergedResults,
      salaryStructure: structure,
    }

    await batchesCollection().updateOne({ id: appendBatchId }, { $set: batchDoc })
    const batch = await enrichBatchWithSentStatus(batchDoc)
    return {
      batch,
      replaced: false,
      appended: true,
      addedCount: employeesToAdd.length,
      resent: [],
    }
  }

  const replaced = !!replaceBatchId

  let id: string = randomUUID()
  let previouslySentEmpIds = new Set<string>()

  if (replaceBatchId) {
    const existing = await batchesCollection().findOne({ id: replaceBatchId })
    if (!existing) {
      throw new Error('Payroll batch to replace was not found')
    }
    id = replaceBatchId
    const sentFlags = await listSentFlagsForBatch(id)
    previouslySentEmpIds = new Set(
      existing.results
        .filter((r) => r.status === 'success' && r.fileName && sentFlags[r.fileName])
        .map((r) => String(r.empId).trim().toUpperCase())
    )
    clearPayslipPdfFiles(id)
    await deletePayslipsForBatch(id)
    await clearSentPayslipsForBatch(id)
  }

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
      const filePath = join(payslipsDir, fileName)
      await savePayslipAsPdf(company, structure, prepared, filePath, templateId)
      await upsertPayslipPdf({
        batchId: id,
        fileName,
        empId,
        payPeriodKey: periodFields.payPeriodKey,
        pdfBuffer: readFileSync(filePath),
      })
      results.push({ empId, name, status: 'success', fileName })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Generation failed'
      results.push({ empId, name, status: 'error', error: message })
    }
  }

  const batchDoc: PayrollBatch = {
    id,
    originalFileName,
    uploadedAt: new Date(),
    payMonth: periodFields.payMonth,
    payPeriodKey: periodFields.payPeriodKey,
    payYear: periodFields.payYear,
    payMonthNum: periodFields.payMonthNum,
    templateId,
    employeeCount: employees.length,
    totalGenerated: results.filter((r) => r.status === 'success').length,
    totalFailed: results.filter((r) => r.status === 'error').length,
    results,
    salaryStructure: structure,
  }

  if (replaced) {
    await batchesCollection().updateOne({ id }, { $set: batchDoc })
    await removeStaleSentPayslips(id, results)
  } else {
    await batchesCollection().insertOne(batchDoc)
  }

  const batch = await enrichBatchWithSentStatus(batchDoc)
  const resent: EmployeePayslipRecord[] = []

  if (options.resendPayslips && previouslySentEmpIds.size > 0) {
    const empMap = options.employeeDbIdByEmpId ?? {}
    for (const r of results) {
      if (r.status !== 'success' || !r.fileName) continue
      const key = String(r.empId).trim().toUpperCase()
      if (!previouslySentEmpIds.has(key)) continue
      try {
        const { record } = await sendPayslipToEmployee({
          batchId: id,
          fileName: r.fileName,
          empId: r.empId,
          payMonth: batch.payMonth,
          payPeriodKey: batch.payPeriodKey,
          employeeDbId: empMap[r.empId],
        })
        resent.push(record)
      } catch {
        /* skip failed resend */
      }
    }
  }

  return { batch, replaced, resent }
}

/** Drop sent records for employees no longer in the regenerated batch. */
async function removeStaleSentPayslips(batchId: string, results: PayslipResult[]): Promise<void> {
  const activeFiles = new Set(
    results.filter((r) => r.status === 'success' && r.fileName).map((r) => r.fileName as string)
  )
  const sent = await getDB().collection<EmployeePayslipRecord>('employee_payslips').find({ batchId }).toArray()
  for (const doc of sent) {
    if (doc.fileName && !activeFiles.has(doc.fileName)) {
      await removeSentPayslip(batchId, doc.fileName)
    }
  }
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

export async function listPayrollBatches(limit = 100): Promise<PayrollBatch[]> {
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
  employeeDbIdByEmpId: Record<string, string> = {},
  options?: { resend?: boolean }
): Promise<{
  batch: PayrollBatch
  sent: number
  skipped: number
  failed: { empId: string; name: string; error: string }[]
  sentRecords: EmployeePayslipRecord[]
}> {
  const raw = await batchesCollection().findOne({ id: batchId })
  if (!raw) {
    throw new Error('Payroll batch not found')
  }

  const resend = options?.resend === true
  const flags = await listSentFlagsForBatch(batchId)
  const toSend = raw.results.filter(
    (r) => r.status === 'success' && r.fileName && (resend || !flags[r.fileName])
  )

  let sent = 0
  const failed: { empId: string; name: string; error: string }[] = []
  const sentRecords: EmployeePayslipRecord[] = []

  for (const r of toSend) {
    if (!r.fileName) continue
    try {
      const { record } = await sendPayslipToEmployee({
        batchId,
        fileName: r.fileName,
        empId: r.empId,
        payMonth: raw.payMonth,
        payPeriodKey: raw.payPeriodKey,
        employeeDbId: employeeDbIdByEmpId[r.empId],
      })
      sentRecords.push(record)
      sent++
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Send failed'
      failed.push({ empId: r.empId, name: r.name, error: message })
    }
  }

  const skipped = resend
    ? 0
    : raw.results.filter((r) => r.status === 'success' && r.fileName && flags[r.fileName]).length

  const batch = await enrichBatchWithSentStatus(raw)
  return { batch, sent, skipped, failed, sentRecords }
}

export function getPayslipFilePath(batchId: string, fileName: string): string {
  return join(getPayslipsDir(batchId), safePayslipFileName(fileName))
}

export function payslipFileNameForEmpId(empId: string): string {
  return `Payslip_${String(empId).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
}

/** Write MongoDB PDF to disk cache for sendFile / merge helpers. */
async function materializePayslipToDisk(
  batchId: string,
  fileName: string,
  pdfBuffer: Buffer
): Promise<string> {
  ensureBatchDirs(batchId)
  const filePath = join(getPayslipsDir(batchId), fileName)
  writeFileSync(filePath, pdfBuffer)
  return resolve(filePath)
}

/** Resolve payslip path — prefers MongoDB; regenerates from Excel if missing. */
export async function ensurePayslipPdfExists(batchId: string, fileName: string): Promise<string> {
  const safeName = safePayslipFileName(fileName)
  const filePath = join(getPayslipsDir(batchId), safeName)

  const stored = await getPayslipPdfBuffer(batchId, safeName)
  if (stored && stored.length > 0) {
    return materializePayslipToDisk(batchId, safeName, stored)
  }

  if (existsSync(filePath)) {
    const batch = await batchesCollection().findOne({ id: batchId })
    const row = batch?.results.find((r) => r.fileName === safeName)
    await upsertPayslipPdfFromFileIfMissing({
      batchId,
      fileName: safeName,
      empId: row?.empId ?? 'Unknown',
      filePath,
      payPeriodKey: batch?.payPeriodKey,
    })
    return resolve(filePath)
  }

  const batch = await batchesCollection().findOne({ id: batchId })
  if (!batch) {
    throw new Error('Payroll batch not found')
  }

  const hasRecord = batch.results.some((r) => r.status === 'success' && r.fileName === safeName)
  if (!hasRecord) {
    throw new Error('Payslip file not found')
  }

  let excelBuffer: Buffer
  try {
    excelBuffer = readBatchExcel(batchId)
  } catch {
    throw new Error(
      'Payslip PDF is missing and the payroll Excel for this batch is no longer available. Re-upload the payroll file to regenerate payslips.'
    )
  }

  const rawBatch = await batchesCollection().findOne({ id: batchId })
  const parsed = await readMasterExcelFromBuffer(excelBuffer)

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
  const empId = String(emp['Emp ID'] || 'Unknown')
  const prepared = await prepareEmployeeForPayslip(company, structure, emp, batchId)
  await savePayslipAsPdf(company, structure, prepared, filePath, templateId)
  const pdfBuffer = readFileSync(filePath)
  await upsertPayslipPdf({
    batchId,
    fileName: safeName,
    empId,
    payPeriodKey: batch.payPeriodKey,
    pdfBuffer,
  })
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
    let bytes = await getPayslipPdfBuffer(batchId, fileName)
    if (!bytes || bytes.length === 0) {
      try {
        const filePath = await ensurePayslipPdfExists(batchId, fileName)
        if (existsSync(filePath)) bytes = readFileSync(filePath)
      } catch {
        continue
      }
    }
    if (!bytes || bytes.length === 0) continue

    const pdf = await PDFDocument.load(bytes)
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
    for (const page of pages) {
      mergedPdf.addPage(page)
    }
  }

  if (mergedPdf.getPageCount() === 0) {
    throw new Error('No payslip PDF files found in storage')
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

/** Remove batch files on disk and related MongoDB records. */
async function removeBatchStorage(batchId: string): Promise<void> {
  const dir = getBatchDir(batchId)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true })
  }

  await batchesCollection().deleteOne({ id: batchId })
  await getDB().collection('employee_payslips').deleteMany({ batchId })
  await deletePayslipsForBatch(batchId)
}

/** Remove uploaded Excel, all generated payslips, and batch record. */
export async function deletePayrollBatch(batchId: string): Promise<void> {
  const batch = await getPayrollBatch(batchId)
  if (!batch) {
    throw new Error('Payroll batch not found')
  }
  await removeBatchStorage(batchId)
}

export interface DeleteAllPayrollDataResult {
  batchesDeleted: number
  diskDirsRemoved: number
  employeePayslipsRemoved: number
  payslipDocumentsRemoved: number
  monthlySnapshotsRemoved: number
}

/** Wipe all payroll uploads, generated PDFs, sent payslips, and YTD snapshots. Keeps template folder. */
export async function deleteAllPayrollData(): Promise<DeleteAllPayrollDataResult> {
  const batchIds = (
    await batchesCollection().find({}, { projection: { id: 1 } }).toArray()
  ).map((b) => b.id)

  for (const batchId of batchIds) {
    await removeBatchStorage(batchId)
  }

  let diskDirsRemoved = 0
  if (existsSync(UPLOADS_ROOT)) {
    for (const name of readdirSync(UPLOADS_ROOT)) {
      if (name === 'template') continue
      const dirPath = join(UPLOADS_ROOT, name)
      try {
        if (statSync(dirPath).isDirectory()) {
          rmSync(dirPath, { recursive: true, force: true })
          diskDirsRemoved++
        }
      } catch {
        /* ignore */
      }
    }
  }

  const db = getDB()
  const employeePayslips = await db.collection('employee_payslips').deleteMany({})
  const payslipDocuments = await db.collection('payslip_documents').deleteMany({})
  const monthlySnapshots = await db.collection('payroll_monthly_snapshots').deleteMany({})

  return {
    batchesDeleted: batchIds.length,
    diskDirsRemoved,
    employeePayslipsRemoved: employeePayslips.deletedCount,
    payslipDocumentsRemoved: payslipDocuments.deletedCount,
    monthlySnapshotsRemoved: monthlySnapshots.deletedCount,
  }
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
  await deletePayslipPdf(batchId, safeName)
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
