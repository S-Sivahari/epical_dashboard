import { Schema, model, Document, Types } from 'mongoose';

export type CellType = 'Block' | 'IO' | 'ESD' | 'TOP';
export type CellStage = 'floor_plan' | 'drc_1' | 'routing' | 'drc_2' | 'lvs';
export type CellStageStatus = 'in_progress' | 'for_review' | 'approved';

export interface CellFeedback {
  authorId: string;
  authorName: string;
  authorRole: 'Admin' | 'Employee';
  message: string;
  createdAt: Date;
}

export interface CellAssignment {
  employeeId: string;
  employeeName: string;
}

export interface CellView {
  fileName?: string;
  mimeType?: string;
  fileData?: Buffer;
  uploadedAt?: Date;
  uploadedBy?: string;
  uploadedByName?: string;
}

export interface CellViews {
  schematic?: CellView;
  symbol?: CellView;
  layout?: CellView;
}

export interface CellChecklistItem {
  id: string;
  label: string;
  required: boolean;
  checked: boolean;
  checkedBy?: string;
  checkedByName?: string;
  checkedAt?: Date;
}

export interface Cell extends Document {
  name: string;
  libraryId: Types.ObjectId;
  type: CellType;
  assignedTo: CellAssignment[];
  currentStage: CellStage;
  stageStatus: CellStageStatus;
  views: CellViews;
  feedbacks: CellFeedback[];
  checklistItems: CellChecklistItem[];
  createdAt: Date;
  updatedAt: Date;
}

const CellFeedbackSchema = new Schema<CellFeedback>(
  {
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, enum: ['Admin', 'Employee'], required: true },
    message: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false }, _id: true }
);

const CellAssignmentSchema = new Schema<CellAssignment>(
  {
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
  },
  { _id: false }
);

const CellViewSchema = new Schema<CellView>(
  {
    fileName: { type: String },
    mimeType: { type: String },
    fileData: { type: Buffer },
    uploadedAt: { type: Date },
    uploadedBy: { type: String },
    uploadedByName: { type: String },
  },
  { _id: false }
);

const CellViewsSchema = new Schema<CellViews>(
  {
    schematic: { type: CellViewSchema },
    symbol: { type: CellViewSchema },
    layout: { type: CellViewSchema },
  },
  { _id: false }
);

const CellChecklistItemSchema = new Schema<CellChecklistItem>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true, trim: true },
    required: { type: Boolean, default: true },
    checked: { type: Boolean, default: false },
    checkedBy: { type: String },
    checkedByName: { type: String },
    checkedAt: { type: Date },
  },
  { _id: false }
);

const CellSchema = new Schema<Cell>(
  {
    name: { type: String, required: true, trim: true },
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    type: {
      type: String,
      enum: ['Block', 'IO', 'ESD', 'TOP'],
      required: true,
    },
    assignedTo: { type: [CellAssignmentSchema], default: [] },
    currentStage: {
      type: String,
      enum: ['floor_plan', 'drc_1', 'routing', 'drc_2', 'lvs'],
      default: 'floor_plan',
    },
    stageStatus: {
      type: String,
      enum: ['in_progress', 'for_review', 'approved'],
      default: 'in_progress',
    },
    views: { type: CellViewsSchema, default: {} },
    feedbacks: { type: [CellFeedbackSchema], default: [] },
    checklistItems: { type: [CellChecklistItemSchema], default: [] },
  },
  { timestamps: true }
);

CellSchema.index({ libraryId: 1, name: 1 }, { unique: true });
CellSchema.index({ currentStage: 1, stageStatus: 1 });

export const CellModel = model<Cell>('Cell', CellSchema);
