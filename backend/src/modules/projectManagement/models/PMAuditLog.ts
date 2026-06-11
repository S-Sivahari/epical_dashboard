import { Schema, model, Document, Types } from 'mongoose';

export interface PMAuditLog extends Document {
  user: string;
  action: string;
  targetId?: Types.ObjectId;
  targetType?: 'Project' | 'Library' | 'Cell' | 'View' | 'ChecklistTemplate' | 'CellChecklistInstance' | 'Assignment' | 'Review';
  previousState?: any;
  newState?: any;
  timestamp: Date;
}

const PMAuditLogSchema = new Schema<PMAuditLog>(
  {
    user: { type: String, required: true },
    action: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId },
    targetType: {
      type: String,
      enum: [
        'Project',
        'Library',
        'Cell',
        'View',
        'ChecklistTemplate',
        'CellChecklistInstance',
        'Assignment',
        'Review',
      ],
    },
    previousState: { type: Schema.Types.Mixed },
    newState: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

PMAuditLogSchema.index({ timestamp: -1 });
PMAuditLogSchema.index({ user: 1, timestamp: -1 });
PMAuditLogSchema.index({ targetId: 1, targetType: 1 });

export const PMAuditLogModel = model<PMAuditLog>('ProjectManagementAuditLog', PMAuditLogSchema);
