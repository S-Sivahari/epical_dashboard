import { Schema, model, Types, Document } from 'mongoose';
import { CELL_TYPES } from './ProjectCell';

export interface CellTypeChecklistItem {
  _id: Types.ObjectId;
  itemName: string;
  order: number;
}

export interface CellTypeChecklistDefinitionDocument extends Document {
  cellType: (typeof CELL_TYPES)[number];
  checklistName: string;
  description: string;
  items: CellTypeChecklistItem[];
  importedFromExcel: boolean;
  lastImportedAt?: Date;
  lastImportedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const cellTypeChecklistItemSchema = new Schema<CellTypeChecklistItem>(
  {
    itemName: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
  },
  { _id: true },
);

const cellTypeChecklistDefinitionSchema = new Schema<CellTypeChecklistDefinitionDocument>(
  {
    cellType: {
      type: String,
      enum: CELL_TYPES,
      required: true,
      unique: true,
    },
    checklistName: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    items: { type: [cellTypeChecklistItemSchema], default: [] },
    importedFromExcel: { type: Boolean, default: false },
    lastImportedAt: { type: Date },
    lastImportedBy: { type: String },
  },
  { timestamps: true, collection: 'celltypechecklistdefinitions' },
);

cellTypeChecklistDefinitionSchema.index({ cellType: 1 }, { unique: true });

export const CellTypeChecklistDefinitionModel = model<CellTypeChecklistDefinitionDocument>(
  'CellTypeChecklistDefinition',
  cellTypeChecklistDefinitionSchema,
);
