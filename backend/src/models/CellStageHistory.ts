import { Schema, model, Document, Types } from 'mongoose';
import type { CellStage } from './Cell';

export interface CellStageHistory extends Document {
  cellId: Types.ObjectId;
  fromStage: CellStage | null;
  toStage: CellStage;
  changedBy: string;
  changedByName: string;
  reason: string;
  changedAt: Date;
}

const CellStageHistorySchema = new Schema<CellStageHistory>(
  {
    cellId: { type: Schema.Types.ObjectId, ref: 'Cell', required: true, index: true },
    fromStage: { type: String, enum: ['floor_plan', 'drc_1', 'routing', 'drc_2', 'lvs'] },
    toStage: {
      type: String,
      enum: ['floor_plan', 'drc_1', 'routing', 'drc_2', 'lvs'],
      required: true,
    },
    changedBy: { type: String, required: true },
    changedByName: { type: String, required: true },
    reason: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'changedAt', updatedAt: false } }
);

export const CellStageHistoryModel = model<CellStageHistory>(
  'CellStageHistory',
  CellStageHistorySchema
);
