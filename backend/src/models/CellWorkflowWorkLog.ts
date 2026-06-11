import { Schema, model, Document, Types } from 'mongoose';
import type { CellWorkflowStageKey } from '../utils/cellWorkflow';

export interface CellWorkflowWorkLog extends Document {
  projectId: Types.ObjectId;
  cellId: Types.ObjectId;
  stageKey: CellWorkflowStageKey;
  checkInTime: Date;
  checkOutTime?: Date | null;
  stageStartTime: Date;
  stageCompletionTime?: Date | null;
  latestActivityTime: Date;
  workedMs: number;
  openedById?: string;
  openedByName?: string;
  closedById?: string;
  closedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CellWorkflowWorkLogSchema = new Schema<CellWorkflowWorkLog>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    cellId: { type: Schema.Types.ObjectId, ref: 'ProjectCell', required: true, index: true },
    stageKey: { type: String, required: true },
    checkInTime: { type: Date, required: true },
    checkOutTime: { type: Date, default: null },
    stageStartTime: { type: Date, required: true },
    stageCompletionTime: { type: Date, default: null },
    latestActivityTime: { type: Date, required: true },
    workedMs: { type: Number, default: 0 },
    openedById: { type: String },
    openedByName: { type: String },
    closedById: { type: String },
    closedByName: { type: String },
  },
  { timestamps: true },
);

CellWorkflowWorkLogSchema.index({ projectId: 1, cellId: 1, stageKey: 1, checkOutTime: 1 });
CellWorkflowWorkLogSchema.index({ cellId: 1, checkOutTime: 1 });

export const CellWorkflowWorkLogModel = model<CellWorkflowWorkLog>(
  'CellWorkflowWorkLog',
  CellWorkflowWorkLogSchema,
);
