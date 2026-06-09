import { Schema, model, Document, Types } from 'mongoose';
import { CELL_TYPES, type CellType } from './ProjectCell';

export interface ProjectTypeChecklistDoc extends Document {
  projectId: Types.ObjectId;
  cellType: CellType;
  fileName: string;
  contentType: string;
  fileData: Buffer;
  uploadedById?: string;
  uploadedByName?: string;
  uploadedAt: Date;
}

const ProjectTypeChecklistSchema = new Schema<ProjectTypeChecklistDoc>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    cellType: { type: String, enum: CELL_TYPES, required: true },
    fileName: { type: String, required: true, trim: true },
    contentType: { type: String, default: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    fileData: { type: Buffer, required: true },
    uploadedById: { type: String },
    uploadedByName: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

ProjectTypeChecklistSchema.index({ projectId: 1, cellType: 1 }, { unique: true });

export const ProjectTypeChecklistModel = model<ProjectTypeChecklistDoc>(
  'ProjectTypeChecklist',
  ProjectTypeChecklistSchema,
);
