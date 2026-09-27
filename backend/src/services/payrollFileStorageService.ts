import { Binary } from 'mongodb'
import type { WithId } from 'mongodb'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { getDB } from '../config/db'

/**
 * Generic MongoDB-backed file store for payroll assets that must survive a redeploy
 * (uploaded payroll Excel per batch, the custom payroll template, the company logo).
 * The container's local disk is wiped on every rebuild, so these can't live there alone.
 */
export interface PayrollFileRecord {
  key: string
  fileName: string
  contentType: string
  data: Buffer
  size: number
  updatedAt: Date
}

const COLLECTION = 'payroll_files'

function filesCollection() {
  return getDB().collection<PayrollFileRecord>(COLLECTION)
}

export async function ensurePayrollFileStorageIndexes(): Promise<void> {
  await filesCollection().createIndex({ key: 1 }, { unique: true })
}

export async function upsertPayrollFile(params: {
  key: string
  fileName: string
  contentType: string
  data: Buffer
}): Promise<void> {
  const doc: PayrollFileRecord = {
    key: params.key,
    fileName: params.fileName,
    contentType: params.contentType,
    data: params.data,
    size: params.data.length,
    updatedAt: new Date(),
  }
  await filesCollection().updateOne({ key: params.key }, { $set: doc }, { upsert: true })
}

export async function getPayrollFile(key: string): Promise<PayrollFileRecord | null> {
  const row = (await filesCollection().findOne({ key })) as WithId<PayrollFileRecord> | null
  if (!row?.data) return null

  const data = row.data as Buffer | Binary | Uint8Array
  const buffer = Buffer.isBuffer(data)
    ? data
    : data instanceof Binary
      ? Buffer.from(data.buffer)
      : data instanceof Uint8Array
        ? Buffer.from(data)
        : null
  if (!buffer) return null
  return { ...row, data: buffer }
}

export async function getPayrollFileBuffer(key: string): Promise<Buffer | null> {
  const row = await getPayrollFile(key)
  return row?.data ?? null
}

export async function deletePayrollFile(key: string): Promise<void> {
  await filesCollection().deleteOne({ key })
}

export async function deletePayrollFilesByPrefix(prefix: string): Promise<void> {
  await filesCollection().deleteMany({ key: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` } })
}

/** Mongo key for a batch's uploaded payroll Excel. */
export function payrollExcelKey(batchId: string): string {
  return `batch-excel:${batchId}`
}

export const CUSTOM_TEMPLATE_KEY = 'custom-template'
export const COMPANY_LOGO_KEY = 'company-logo'

/**
 * Read a buffer through a local-disk cache backed by MongoDB as the durable copy.
 * Local disk is wiped on every redeploy, so callers never need their own restore step —
 * a disk hit returns immediately, a miss is served from Mongo and written back to disk.
 * Returns null if neither disk nor Mongo has the file (or the stored copy is empty/corrupt).
 */
export async function readWithDiskCache(diskPath: string, mongoKey: string): Promise<Buffer | null> {
  if (existsSync(diskPath)) {
    const onDisk = readFileSync(diskPath)
    if (onDisk.length > 0) return onDisk
  }
  const fromMongo = await getPayrollFileBuffer(mongoKey)
  if (!fromMongo || fromMongo.length === 0) return null
  try {
    const dir = dirname(diskPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(diskPath, fromMongo)
  } catch (err) {
    console.warn(`[payrollFileStorageService] Failed to re-cache ${mongoKey} to disk at ${diskPath}:`, err)
  }
  return fromMongo
}

/** Write a buffer to both the local-disk cache and MongoDB (the durable copy). */
export async function writeWithDiskCache(params: {
  diskPath: string
  mongoKey: string
  fileName: string
  contentType: string
  data: Buffer
}): Promise<void> {
  try {
    const dir = dirname(params.diskPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(params.diskPath, params.data)
  } catch (err) {
    console.warn(`[payrollFileStorageService] Failed to write ${params.mongoKey} to disk at ${params.diskPath} (continuing with MongoDB write):`, err)
  }
  await upsertPayrollFile({
    key: params.mongoKey,
    fileName: params.fileName,
    contentType: params.contentType,
    data: params.data,
  })
}
