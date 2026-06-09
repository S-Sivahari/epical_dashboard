import { Schema, model, Document, Types } from 'mongoose';
import { CELL_TYPES, type CellType } from './ProjectCell';

export type TypeChecklistAnswer = 'yes' | 'no' | 'not_applicable';

export interface CellTypeChecklistResponseDoc extends Document {
  projectId: Types.ObjectId;
  cellId: Types.ObjectId;
  cellType: CellType;
  itemIndex: number;
  itemName: string;
  response: TypeChecklistAnswer | null;
  comment: string;
  answeredById?: string;
  answeredByName?: string;
  answeredAt?: Date;
}

const CellTypeChecklistResponseSchema = new Schema<CellTypeChecklistResponseDoc>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    cellId: { type: Schema.Types.ObjectId, ref: 'ProjectCell', required: true, index: true },
    cellType: { type: String, enum: CELL_TYPES, required: true },
    itemIndex: { type: Number, required: true, min: 0 },
    itemName: { type: String, required: true, trim: true },
    response: {
      type: String,
      enum: ['yes', 'no', 'not_applicable', null],
      default: null,
    },
    comment: { type: String, default: '' },
    answeredById: { type: String },
    answeredByName: { type: String },
    answeredAt: { type: Date },
  },
  { timestamps: true },
);

CellTypeChecklistResponseSchema.index({ cellId: 1, itemIndex: 1 }, { unique: true });
CellTypeChecklistResponseSchema.index({ projectId: 1, cellType: 1 });

export const CellTypeChecklistResponseModel = model<CellTypeChecklistResponseDoc>(
  'CellTypeChecklistResponse',
  CellTypeChecklistResponseSchema,
);
