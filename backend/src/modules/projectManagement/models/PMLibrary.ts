import { Schema, model, Document, Types } from 'mongoose';

export interface PMLibrary extends Document {
  projectId: Types.ObjectId;
  name: string;
  description?: string;
  progress: number;
  status: 'In Progress' | 'Completed';
  isArchived: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const PMLibrarySchema = new Schema<PMLibrary>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    name: { type: String, required: true },
    description: { type: String },
    progress: { type: Number, default: 0 },
    status: { type: String, enum: ['In Progress', 'Completed'], default: 'In Progress' },
    isArchived: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

// Indexes for speed and scaling
PMLibrarySchema.index({ projectId: 1, isArchived: 1 });
PMLibrarySchema.index({ name: 1 });

export const PMLibraryModel = model<PMLibrary>('ProjectManagementLibrary', PMLibrarySchema);
