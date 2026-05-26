import { Binary } from 'mongodb'
import { readFileSync, existsSync } from 'fs'
import type { WithId } from 'mongodb'
import { getDB } from '../config/db'

export interface PayslipDocumentRecord {
  batchId: string
  fileName: string
  empId: string
  payPeriodKey?: string
  contentType: string
  pdfData: Buffer
  size: number
  generatedAt: Date
}

const COLLECTION = 'payslip_documents'

function payslipDocsCollection() {
  return getDB().collection<PayslipDocumentRecord>(COLLECTION)
}

/** Ensure indexes exist (idempotent). */
export async function ensurePayslipStorageIndexes(): Promise<void> {
  const col = payslipDocsCollection()
  await col.createIndex({ batchId: 1, fileName: 1 }, { unique: true })
  await col.createIndex({ batchId: 1 })
  await col.createIndex({ payPeriodKey: 1 })
}

/** Store or replace a generated payslip PDF in MongoDB. */
export async function upsertPayslipPdf(params: {
  batchId: string
  fileName: string
  empId: string
  pdfBuffer: Buffer
  payPeriodKey?: string
}): Promise<void> {
  const pdfBuffer = params.pdfBuffer
  const doc: PayslipDocumentRecord = {
    batchId: params.batchId,
    fileName: params.fileName,
    empId: params.empId,
    payPeriodKey: params.payPeriodKey,
    contentType: 'application/pdf',
    pdfData: pdfBuffer,
    size: pdfBuffer.length,
    generatedAt: new Date(),
  }

  await payslipDocsCollection().updateOne(
    { batchId: params.batchId, fileName: params.fileName },
    { $set: doc },
    { upsert: true }
  )
}

/** Read payslip PDF bytes from MongoDB. */
export async function getPayslipPdfBuffer(
  batchId: string,
  fileName: string
): Promise<Buffer | null> {
  const row = (await payslipDocsCollection().findOne({ batchId, fileName })) as WithId<
    PayslipDocumentRecord
  > | null
  if (!row?.pdfData) return null

  const data = row.pdfData as Buffer | Binary | Uint8Array
  if (Buffer.isBuffer(data)) return data
  if (data instanceof Binary) return Buffer.from(data.buffer)
  if (data instanceof Uint8Array) return Buffer.from(data)
  return null
}

/** Import an on-disk PDF into MongoDB if missing (migration / fallback). */
export async function upsertPayslipPdfFromFileIfMissing(params: {
  batchId: string
  fileName: string
  empId: string
  filePath: string
  payPeriodKey?: string
}): Promise<boolean> {
  const existing = await getPayslipPdfBuffer(params.batchId, params.fileName)
  if (existing && existing.length > 0) return false
  if (!existsSync(params.filePath)) return false

  await upsertPayslipPdf({
    batchId: params.batchId,
    fileName: params.fileName,
    empId: params.empId,
    pdfBuffer: readFileSync(params.filePath),
    payPeriodKey: params.payPeriodKey,
  })
  return true
}

export async function deletePayslipPdf(batchId: string, fileName: string): Promise<void> {
  await payslipDocsCollection().deleteOne({ batchId, fileName })
}

export async function deletePayslipsForBatch(batchId: string): Promise<void> {
  await payslipDocsCollection().deleteMany({ batchId })
}

export async function countPayslipsInMongo(batchId: string): Promise<number> {
  return payslipDocsCollection().countDocuments({ batchId })
}
