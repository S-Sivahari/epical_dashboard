import { ObjectId } from 'mongodb';

export type DocumentRequestStatus = 'Requested' | 'Approved' | 'Rejected';

export interface DocumentFulfillmentFile {
  filename: string;
  contentType: string;
  /** Base64 binary */
  data: string;
}

export interface DocumentRequestDoc {
  _id?: ObjectId;
  id: string;
  employeeUserId: string;
  /** Display / HR reference id */
  employeeId: string;
  employeeName: string;
  documentType: string;
  documentName: string;
  /** Reason given by employee when requesting */
  reason: string;
  status: DocumentRequestStatus;
  requestedAt: Date;
  processedAt?: Date;
  processedBy?: string;
  rejectionReason?: string;
  fulfillmentFile?: DocumentFulfillmentFile;
  /** Added when serializing lists to clients */
  hasFulfillmentFile?: boolean;
}

export interface CreateDocumentRequestPayload {
  documentType: string;
  documentName: string;
  reason: string;
}
