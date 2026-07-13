import { Collection } from 'mongodb';
import { getDB } from '../config/db';
import {
  CreateDocumentRequestPayload,
  DocumentFulfillmentFile,
  DocumentRequestDoc,
  DocumentRequestStatus,
} from '../models/DocumentRequest';
import * as notificationService from './notificationService';

let col: Collection<DocumentRequestDoc & { _data?: unknown }> | null = null;
let indexesCreated = false;

function getCol(): Collection<any> {
  if (!col) {
    col = getDB().collection('documentRequests');
    // Create indexes on first access for better query performance
    if (!indexesCreated) {
      void createIndexes();
      indexesCreated = true;
    }
  }
  return col!;
}

async function createIndexes(): Promise<void> {
  try {
    const collection = getDB().collection('documentRequests');
    await Promise.all([
      collection.createIndex({ id: 1 }, { unique: true }),
      collection.createIndex({ employeeUserId: 1 }),
      collection.createIndex({ status: 1 }),
      collection.createIndex({ requestedAt: -1 }),
      collection.createIndex({ processedAt: -1 }),
      collection.createIndex({ status: 1, requestedAt: -1 }),
      collection.createIndex({ status: 1, processedAt: -1 }),
    ]);
  } catch (error) {
    console.error('Failed to create documentRequests indexes:', error);
  }
}

async function resolveEmployeeDisplay(userId: string, fallbackName: string): Promise<{ employeeId: string; employeeName: string }> {
  const empColl = getDB().collection('employees');
  const emp = await empColl.findOne({
    $or: [{ id: userId }, { employeeId: userId }],
  });
  if (emp) {
    const name =
      `${emp.firstName ?? ''}${emp.middleName ? ` ${emp.middleName}` : ''} ${emp.lastName ?? ''}`.trim();
    return { employeeId: emp.employeeId || emp.id || userId, employeeName: name || fallbackName };
  }
  return { employeeId: userId, employeeName: fallbackName };
}

export async function createDocumentRequest(
  employeeUserId: string,
  employeeFallbackName: string,
  payload: CreateDocumentRequestPayload
): Promise<DocumentRequestDoc> {
  const ctx = await resolveEmployeeDisplay(employeeUserId, employeeFallbackName);
  const doc: DocumentRequestDoc = {
    id: `DR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    employeeUserId,
    employeeId: ctx.employeeId,
    employeeName: ctx.employeeName,
    documentType: payload.documentType.trim(),
    documentName: payload.documentName.trim(),
    reason: payload.reason.trim(),
    status: 'Requested',
    requestedAt: new Date(),
  };
  await getCol().insertOne(doc as any);
  
  // Notify all admins about the new document request
  try {
    await notificationService.notifyAllAdmins({
      type: 'DocumentRequested',
      title: 'New Document Request',
      message: `${ctx.employeeName} requested ${payload.documentName}`,
      relatedData: {
        employeeId: ctx.employeeId,
        employeeName: ctx.employeeName,
        documentName: payload.documentName.trim(),
        documentType: payload.documentType.trim(),
      },
      relatedId: doc.id,
    });
  } catch (error) {
    console.error('[Document Request] Failed to create admin notifications:', error);
  }
  
  return sanitize(doc as DocumentRequestDoc) as DocumentRequestDoc;
}

export async function uploadFulfillment(
  id: string,
  file: { originalname: string; mimetype: string; buffer: Buffer }
): Promise<DocumentRequestDoc | null> {
  const existing = (await getCol().findOne({ id }, { projection: { 'fulfillmentFile.data': 0 } })) as DocumentRequestDoc | null;
  if (!existing || existing.status !== 'Requested') return null;

  const fulfillmentFile: DocumentFulfillmentFile = {
    filename: file.originalname,
    contentType: file.mimetype,
    data: file.buffer.toString('base64'),
  };

  await getCol().updateOne({ id, status: 'Requested' }, { $set: { fulfillmentFile } });
  const row = await getCol().findOne({ id }, { projection: { 'fulfillmentFile.data': 0 } });
  return sanitize(row as DocumentRequestDoc) as DocumentRequestDoc | null;
}

export async function approveDocumentRequest(id: string, adminName: string): Promise<DocumentRequestDoc | null> {
  const existing = (await getCol().findOne({ id })) as DocumentRequestDoc | null;
  if (!existing || existing.status !== 'Requested') return null;
  // Check the actual fulfillmentFile object, not the computed hasFulfillmentFile field
  if (!existing.fulfillmentFile?.data) {
    throw new Error('Upload the generated document before approving');
  }

  const now = new Date();
  await getCol().updateOne(
    { id, status: 'Requested' },
    {
      $set: {
        status: 'Approved' as DocumentRequestStatus,
        processedAt: now,
        processedBy: adminName,
      },
    }
  );
  const row = await getCol().findOne({ id }, { projection: { 'fulfillmentFile.data': 0 } });
  
  // Notify the employee about approval
  try {
    await notificationService.createNotification({
      recipientId: existing.employeeUserId,
      recipientType: 'Employee',
      type: 'DocumentApproved',
      title: 'Document Request Approved',
      message: `Your request for ${existing.documentName} has been approved and is ready for download`,
      relatedData: {
        employeeId: existing.employeeId,
        employeeName: existing.employeeName,
      },
      relatedId: id,
    });
  } catch (error) {
    console.error('[Document Request] Failed to create employee notification:', error);
  }
  
  return sanitize(row as DocumentRequestDoc) as DocumentRequestDoc | null;
}

export async function rejectDocumentRequest(
  id: string,
  adminName: string,
  rejectionReason: string
): Promise<DocumentRequestDoc | null> {
  const reason = rejectionReason?.trim();
  if (!reason) throw new Error('Rejection reason is required');

  const existing = (await getCol().findOne({ id }, { projection: { 'fulfillmentFile.data': 0 } })) as DocumentRequestDoc | null;
  if (!existing || existing.status !== 'Requested') return null;

  const now = new Date();
  await getCol().updateOne(
    { id, status: 'Requested' },
    {
      $set: {
        status: 'Rejected' as DocumentRequestStatus,
        processedAt: now,
        processedBy: adminName,
        rejectionReason: reason,
      },
      $unset: { fulfillmentFile: '' },
    }
  );
  const row = await getCol().findOne({ id }, { projection: { 'fulfillmentFile.data': 0 } });
  
  // Notify the employee about rejection
  try {
    await notificationService.createNotification({
      recipientId: existing.employeeUserId,
      recipientType: 'Employee',
      type: 'DocumentRejected',
      title: 'Document Request Rejected',
      message: `Your request for ${existing.documentName} was rejected: ${reason}`,
      relatedData: {
        employeeId: existing.employeeId,
        employeeName: existing.employeeName,
      },
      relatedId: id,
    });
  } catch (error) {
    console.error('[Document Request] Failed to create employee notification:', error);
  }
  
  return sanitize(row as DocumentRequestDoc) as DocumentRequestDoc | null;
}

function sanitize(doc: DocumentRequestDoc | null | undefined): DocumentRequestDoc | null {
  if (!doc) return null;
  const rest = { ...doc } as DocumentRequestDoc & { fulfillmentFile?: DocumentFulfillmentFile };
  // Check if fulfillmentFile exists (even if data is projected out)
  const hasFile = Boolean(rest.fulfillmentFile?.data || rest.fulfillmentFile?.filename);
  delete (rest as any).fulfillmentFile;
  return { ...rest, hasFulfillmentFile: hasFile } as DocumentRequestDoc;
}

/** Raw document including binary payload (for downloads). */
export async function getDocumentRequestRawById(id: string): Promise<DocumentRequestDoc | null> {
  const doc = await getCol().findOne({ id });
  return doc as DocumentRequestDoc | null;
}

export async function listForEmployee(userId: string): Promise<DocumentRequestDoc[]> {
  const items = await getCol()
    .find({ employeeUserId: userId }, { projection: { 'fulfillmentFile.data': 0 } })
    .sort({ requestedAt: -1 })
    .toArray();
  return items.map((row) => sanitize(row)) as DocumentRequestDoc[];
}

export async function listForAdmin(filters: {
  status?: DocumentRequestStatus;
  page: number;
  limit: number;
}): Promise<{ items: DocumentRequestDoc[]; total: number }> {
  const query: Record<string, unknown> = {};
  if (filters.status) query.status = filters.status;

  const total = await getCol().countDocuments(query);
  const skip = Math.max(0, (filters.page - 1) * filters.limit);
  const items = await getCol()
    .find(query, { projection: { 'fulfillmentFile.data': 0 } })
    .sort({ requestedAt: -1 })
    .skip(skip)
    .limit(filters.limit)
    .toArray();

  return {
    items: items.map((row) => sanitize(row)) as any,
    total,
  };
}

/** History tab: Approved + Rejected chronological, optionally filtered by status */
export async function listHistory(filters: {
  page: number;
  limit: number;
  status?: Extract<DocumentRequestStatus, 'Approved' | 'Rejected'>;
}): Promise<{ items: DocumentRequestDoc[]; total: number }> {
  const query: Record<string, unknown> = filters.status
    ? { status: filters.status }
    : { status: { $in: ['Approved', 'Rejected'] } };
  const total = await getCol().countDocuments(query);
  const skip = Math.max(0, (filters.page - 1) * filters.limit);
  const items = await getCol()
    .find(query, { projection: { 'fulfillmentFile.data': 0 } })
    .sort({ processedAt: -1, requestedAt: -1 })
    .skip(skip)
    .limit(filters.limit)
    .toArray();

  return {
    items: items.map((row) => sanitize(row)) as any,
    total,
  };
}

export function getFulfillmentForDownload(doc: DocumentRequestDoc): Buffer | null {
  if (!doc.fulfillmentFile?.data) return null;
  return Buffer.from(doc.fulfillmentFile.data, 'base64');
}
