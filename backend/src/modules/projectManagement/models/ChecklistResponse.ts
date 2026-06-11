import { Schema, model, Document, Types } from 'mongoose';

export interface ChecklistAnswer {
  itemId: string;
  text: string;
  category: string;
  isMandatory: boolean;
  response: 'Pass' | 'Fail' | 'None';
  notes?: string;
  remarks?: string;
  order: number;
}

export interface ChecklistResponse extends Document {
  cellId: Types.ObjectId;
  viewId: Types.ObjectId;
  viewType: 'Schematic' | 'Symbol' | 'Layout';
  checklistType: 'Block' | 'IO' | 'ESD' | 'TOP';
  templateVersionId: Types.ObjectId;
  answers: ChecklistAnswer[];
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Approved' | 'Rejected';
  completedCount: number;
  totalCount: number;
  submittedBy?: string;
  submittedAt?: Date;
  updatedAt: Date;
}

const ChecklistAnswerSchema = new Schema<ChecklistAnswer>(
  {
    itemId: { type: String, required: true },
    text: { type: String, required: true },
    category: { type: String, default: 'General' },
    isMandatory: { type: Boolean, default: true },
    response: { type: String, enum: ['Pass', 'Fail', 'None'], default: 'None' },
    notes: { type: String },
    remarks: { type: String },
    order: { type: Number, required: true },
  },
  { _id: false }
);

const ChecklistResponseSchema = new Schema<ChecklistResponse>(
  {
    cellId: { type: Schema.Types.ObjectId, ref: 'ProjectManagementCell', required: true },
    viewId: { type: Schema.Types.ObjectId, ref: 'ProjectManagementView', required: true },
    viewType: { type: String, enum: ['Schematic', 'Symbol', 'Layout'], required: true },
    checklistType: { type: String, enum: ['Block', 'IO', 'ESD', 'TOP'], required: true },
    templateVersionId: { type: Schema.Types.ObjectId, ref: 'ChecklistTemplateVersion', required: true },
    answers: { type: [ChecklistAnswerSchema], default: [] },
    status: {
      type: String,
      enum: ['Not Started', 'In Progress', 'Completed', 'Approved', 'Rejected'],
      default: 'Not Started',
    },
    completedCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
    submittedBy: { type: String },
    submittedAt: { type: Date },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

ChecklistResponseSchema.index({ cellId: 1, viewType: 1 }, { unique: true });
ChecklistResponseSchema.index({ viewId: 1 }, { unique: true });

export const ChecklistResponseModel = model<ChecklistResponse>('ChecklistResponse', ChecklistResponseSchema);
