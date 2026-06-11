import { Schema, model, Document } from 'mongoose';

export type CellType = 'Block' | 'IO' | 'ESD' | 'TOP';

export interface TypeChecklistItem {
  id: string;
  label: string;
}

export interface CellTypeChecklist extends Document {
  cellType: CellType;
  items: TypeChecklistItem[];
  fileName?: string;
  fileData?: Buffer;
  mimeType?: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const TypeChecklistItemSchema = new Schema<TypeChecklistItem>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const CellTypeChecklistSchema = new Schema<CellTypeChecklist>(
  {
    cellType: {
      type: String,
      enum: ['Block', 'IO', 'ESD', 'TOP'],
      required: true,
      unique: true,
      index: true,
    },
    items: { type: [TypeChecklistItemSchema], default: [] },
    fileName: { type: String },
    fileData: { type: Buffer },
    mimeType: { type: String },
    uploadedBy: { type: String, required: true },
    uploadedByName: { type: String, required: true },
  },
  { timestamps: true }
);

export const CellTypeChecklistModel = model<CellTypeChecklist>(
  'CellTypeChecklist',
  CellTypeChecklistSchema
);
