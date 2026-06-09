import { Schema, model, Document, Types } from 'mongoose';

export interface CellHiddenChecklistItemDoc extends Document {
  cellId: Types.ObjectId;
  itemIndex: number;
  hiddenById?: string;
  hiddenByName?: string;
}

const CellHiddenChecklistItemSchema = new Schema<CellHiddenChecklistItemDoc>(
  {
    cellId: { type: Schema.Types.ObjectId, ref: 'ProjectCell', required: true, index: true },
    itemIndex: { type: Number, required: true, min: 0 },
    hiddenById: { type: String },
    hiddenByName: { type: String },
  },
  { timestamps: true },
);

CellHiddenChecklistItemSchema.index({ cellId: 1, itemIndex: 1 }, { unique: true });

export const CellHiddenChecklistItemModel = model<CellHiddenChecklistItemDoc>(
  'CellHiddenChecklistItem',
  CellHiddenChecklistItemSchema,
);
