import { Schema, model, Document, Types } from 'mongoose';

export interface ProjectLibrary extends Document {
  projectId: Types.ObjectId;
  name: string;
  description: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectLibrarySchema = new Schema<ProjectLibrary>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    createdBy: { type: String },
  },
  { timestamps: true },
);

ProjectLibrarySchema.index({ projectId: 1, name: 1 });

export const ProjectLibraryModel = model<ProjectLibrary>('ProjectLibrary', ProjectLibrarySchema);
