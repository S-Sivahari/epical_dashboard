import { Schema, model, Document, Types } from 'mongoose';

export interface AdminAuditLog extends Document {
  adminEmail: string;
  action: string;
  details?: string;
  relatedId?: Types.ObjectId;
  relatedType?: string;
  previousState?: any;
  newState?: any;
  timestamp: Date;
}

const AdminAuditLogSchema = new Schema<AdminAuditLog>(
  {
    adminEmail: { type: String, required: true },
    action: { type: String, required: true },
    details: { type: String },
    relatedId: { type: Schema.Types.ObjectId },
    relatedType: { type: String },
    previousState: { type: Schema.Types.Mixed },
    newState: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

AdminAuditLogSchema.index({ timestamp: -1 });

export const AdminAuditLogModel = model<AdminAuditLog>('AdminAuditLog', AdminAuditLogSchema);
