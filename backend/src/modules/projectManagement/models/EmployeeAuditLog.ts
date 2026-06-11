import { Schema, model, Document, Types } from 'mongoose';

export interface EmployeeAuditLog extends Document {
  employeeId: string;
  employeeName: string;
  action: string;
  details?: string;
  relatedId?: Types.ObjectId;
  relatedType?: string;
  timestamp: Date;
}

const EmployeeAuditLogSchema = new Schema<EmployeeAuditLog>(
  {
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    action: { type: String, required: true },
    details: { type: String },
    relatedId: { type: Schema.Types.ObjectId },
    relatedType: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

EmployeeAuditLogSchema.index({ employeeId: 1, timestamp: -1 });
EmployeeAuditLogSchema.index({ timestamp: -1 });

export const EmployeeAuditLogModel = model<EmployeeAuditLog>('EmployeeAuditLog', EmployeeAuditLogSchema);
