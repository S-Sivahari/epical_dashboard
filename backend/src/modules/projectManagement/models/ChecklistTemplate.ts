import { Schema, model, Document } from 'mongoose';

export interface ChecklistTemplate extends Document {
  checklistType: 'Block' | 'IO' | 'ESD' | 'TOP';
  latestVersion: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ChecklistTemplateSchema = new Schema<ChecklistTemplate>(
  {
    checklistType: { type: String, enum: ['Block', 'IO', 'ESD', 'TOP'], required: true, unique: true },
    latestVersion: { type: Number, default: 1 },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const ChecklistTemplateModel = model<ChecklistTemplate>('ChecklistTemplate', ChecklistTemplateSchema);
