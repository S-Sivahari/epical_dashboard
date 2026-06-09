import { Schema, model, Document, Types } from 'mongoose';
import { CELL_TYPES, type CellType } from './ProjectCell';
import type { TypeChecklistAnswer } from './CellTypeChecklistResponse';

export interface CellCustomChecklistItemDoc extends Document {
  projectId: Types.ObjectId;
  cellId: Types.ObjectId;
  cellType: CellType;
  itemName: string;
  sortOrder: number;
  response: TypeChecklistAnswer | null;
  comment: string;
  createdById?: string;
  createdByName?: string;
  answeredById?: string;
  answeredByName?: string;
  answeredAt?: Date;
}

const CellCustomChecklistItemSchema = new Schema<CellCustomChecklistItemDoc>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    cellId: { type: Schema.Types.ObjectId, ref: 'ProjectCell', required: true, index: true },
    cellType: { type: String, enum: CELL_TYPES, required: true },
    itemName: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    response: {
      type: String,
      enum: ['yes', 'no', 'not_applicable', null],
      default: null,
    },
    comment: { type: String, default: '' },
    createdById: { type: String },
    createdByName: { type: String },
    answeredById: { type: String },
    answeredByName: { type: String },
    answeredAt: { type: Date },
  },
  { timestamps: true },
);

CellCustomChecklistItemSchema.index({ cellId: 1, sortOrder: 1 });

export const CellCustomChecklistItemModel = model<CellCustomChecklistItemDoc>(
  'CellCustomChecklistItem',
  CellCustomChecklistItemSchema,
);
