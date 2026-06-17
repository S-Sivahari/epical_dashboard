import { Schema, model, Types, Document } from 'mongoose';

export interface ChecklistItemSubdoc {
  _id: Types.ObjectId;
  itemName: string;
  order: number;
}

export interface ChecklistDocument extends Document {
  name: string;
  description: string;
  cellType?: string;
  items: ChecklistItemSubdoc[];
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const checklistItemSchema = new Schema<ChecklistItemSubdoc>(
  {
    itemName: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
  },
  { _id: true },
);

const checklistSchema = new Schema<ChecklistDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    cellType: { type: String, enum: ['block', 'IO', 'ESD', 'TOP'] },
    items: { type: [checklistItemSchema], default: [] },
    createdBy: { type: String },
  },
  { timestamps: true },
);

checklistSchema.index({ name: 1 });
checklistSchema.index({ cellType: 1 }, { unique: true, sparse: true });

export const ChecklistModel = model<ChecklistDocument>('Checklist', checklistSchema);

export type ProjectChecklistStatus = 'Applied' | 'Partial' | 'Not Applied';
export type CellChecklistStatus = 'Applied' | 'Pending' | 'Not Assigned';

export interface ProjectChecklistDocument extends Document {
  projectId: Types.ObjectId;
  checklistId: Types.ObjectId;
  selectedItemIds: Types.ObjectId[];
  status: ProjectChecklistStatus;
  completionPercentage: number;
  totalCells: number;
  appliedCells: number;
  createdAt: Date;
  updatedAt: Date;
}

const projectChecklistSchema = new Schema<ProjectChecklistDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    checklistId: { type: Schema.Types.ObjectId, ref: 'Checklist', required: true },
    selectedItemIds: [{ type: Schema.Types.ObjectId }],
    status: {
      type: String,
      enum: ['Applied', 'Partial', 'Not Applied'],
      default: 'Not Applied',
    },
    completionPercentage: { type: Number, default: 0, min: 0, max: 100 },
    totalCells: { type: Number, default: 0 },
    appliedCells: { type: Number, default: 0 },
  },
  { timestamps: true },
);

projectChecklistSchema.index({ projectId: 1 }, { unique: true });

export const ProjectChecklistModel = model<ProjectChecklistDocument>(
  'ProjectChecklist',
  projectChecklistSchema,
);

export type CellChecklistResponse = 'yes' | 'no' | 'not_applicable';

export interface CellChecklistMappingDocument extends Document {
  projectId: Types.ObjectId;
  cellId: Types.ObjectId;
  checklistId: Types.ObjectId;
  checklistItemId: Types.ObjectId;
  itemName: string;
  status: CellChecklistStatus;
  response?: CellChecklistResponse | null;
  comment?: string;
  appliedBy?: string;
  appliedByName?: string;
  appliedDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const cellChecklistMappingSchema = new Schema<CellChecklistMappingDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    cellId: { type: Schema.Types.ObjectId, ref: 'ProjectCell', required: true, index: true },
    checklistId: { type: Schema.Types.ObjectId, ref: 'Checklist', required: true },
    checklistItemId: { type: Schema.Types.ObjectId, required: true },
    itemName: { type: String, required: true },
    status: {
      type: String,
      enum: ['Applied', 'Pending', 'Not Assigned'],
      default: 'Not Assigned',
    },
    response: {
      type: String,
      enum: ['yes', 'no', 'not_applicable', null],
      default: null,
    },
    comment: { type: String, default: '' },
  },
  { timestamps: true },
);

cellChecklistMappingSchema.index({ cellId: 1, checklistItemId: 1 }, { unique: true });
cellChecklistMappingSchema.index({ projectId: 1, checklistId: 1 });

export const CellChecklistMappingModel = model<CellChecklistMappingDocument>(
  'CellChecklistMapping',
  cellChecklistMappingSchema,
);
