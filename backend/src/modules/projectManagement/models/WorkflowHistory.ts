import { Schema, model, Document, Types } from 'mongoose';

export interface WorkflowHistory extends Document {
  viewId: Types.ObjectId;
  viewType: string;
  cellId: Types.ObjectId;
  stageFrom: string;
  stageTo: string;
  action: string;
  changedBy: string;
  comments?: string;
  timestamp: Date;
}

const WorkflowHistorySchema = new Schema<WorkflowHistory>(
  {
    viewId: { type: Schema.Types.ObjectId, ref: 'ProjectManagementView', required: true },
    viewType: { type: String, required: true },
    cellId: { type: Schema.Types.ObjectId, ref: 'ProjectManagementCell', required: true },
    stageFrom: { type: String, required: true },
    stageTo: { type: String, required: true },
    action: { type: String, required: true },
    changedBy: { type: String, required: true },
    comments: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

WorkflowHistorySchema.index({ viewId: 1, timestamp: -1 });

export const WorkflowHistoryModel = model<WorkflowHistory>('WorkflowHistory', WorkflowHistorySchema);
