import { Schema, model, Document, Types } from 'mongoose';

export interface ChecklistItemTemplate {
  itemId: string;
  text: string;
  category: string;
  isMandatory: boolean;
  order: number;
}

export interface ChecklistTemplateVersion extends Document {
  templateId: Types.ObjectId;
  checklistType: 'Block' | 'IO' | 'ESD' | 'TOP';
  version: number;
  items: ChecklistItemTemplate[];
  fileName?: string;
  uploadedBy: string;
  createdAt: Date;
}

const ChecklistItemTemplateSchema = new Schema<ChecklistItemTemplate>(
  {
    itemId: { type: String, required: true },
    text: { type: String, required: true },
    category: { type: String, default: 'General' },
    isMandatory: { type: Boolean, default: true },
    order: { type: Number, required: true },
  },
  { _id: false }
);

const ChecklistTemplateVersionSchema = new Schema<ChecklistTemplateVersion>(
  {
    templateId: { type: Schema.Types.ObjectId, ref: 'ChecklistTemplate', required: true },
    checklistType: { type: String, enum: ['Block', 'IO', 'ESD', 'TOP'], required: true },
    version: { type: Number, required: true },
    items: { type: [ChecklistItemTemplateSchema], default: [] },
    fileName: { type: String },
    uploadedBy: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ChecklistTemplateVersionSchema.index({ templateId: 1, version: 1 }, { unique: true });
ChecklistTemplateVersionSchema.index({ checklistType: 1, version: 1 });

export const ChecklistTemplateVersionModel = model<ChecklistTemplateVersion>(
  'ChecklistTemplateVersion',
  ChecklistTemplateVersionSchema
);
