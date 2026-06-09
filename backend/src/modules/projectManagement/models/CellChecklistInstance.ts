import { Schema, model, Document, Types } from 'mongoose';

export interface CellChecklistItem {
  itemId: string;
  text: string;
  category: string;
  isMandatory: boolean;
  isCompleted: boolean;
  notes?: string;
  observations?: string;
  isCustom: boolean; // manually added by employee or admin to this cell
  isArchived: boolean;
  order: number;
}

export interface CellChecklistInstance extends Document {
  cellId: Types.ObjectId;
  templateVersionId: Types.ObjectId;
  checklistType: 'Block' | 'IO' | 'ESD' | 'TOP';
  items: CellChecklistItem[];
  completedCount: number;
  totalCount: number;
  updatedAt: Date;
}

const CellChecklistItemSchema = new Schema<CellChecklistItem>(
  {
    itemId: { type: String, required: true },
    text: { type: String, required: true },
    category: { type: String, default: 'General' },
    isMandatory: { type: Boolean, default: true },
    isCompleted: { type: Boolean, default: false },
    notes: { type: String },
    observations: { type: String },
    isCustom: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    order: { type: Number, required: true },
  },
  { _id: false }
);

const CellChecklistInstanceSchema = new Schema<CellChecklistInstance>(
  {
    cellId: { type: Schema.Types.ObjectId, ref: 'ProjectManagementCell', required: true, unique: true },
    templateVersionId: { type: Schema.Types.ObjectId, ref: 'ChecklistTemplateVersion', required: true },
    checklistType: { type: String, enum: ['Block', 'IO', 'ESD', 'TOP'], required: true },
    items: { type: [CellChecklistItemSchema], default: [] },
    completedCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

CellChecklistInstanceSchema.index({ cellId: 1 });

export const CellChecklistInstanceModel = model<CellChecklistInstance>(
  'CellChecklistInstance',
  CellChecklistInstanceSchema
);
