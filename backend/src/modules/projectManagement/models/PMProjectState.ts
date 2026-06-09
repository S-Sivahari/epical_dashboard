import { Schema, model, Document, Types } from 'mongoose';

export interface PMProjectState extends Document {
  projectId: Types.ObjectId;
  progress: number;
  status: 'In Progress' | 'Completed';
  createdAt: Date;
  updatedAt: Date;
}

const PMProjectStateSchema = new Schema<PMProjectState>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
    progress: { type: Number, default: 0 },
    status: { type: String, enum: ['In Progress', 'Completed'], default: 'In Progress' },
  },
  { timestamps: true }
);

PMProjectStateSchema.index({ projectId: 1 });

export const PMProjectStateModel = model<PMProjectState>('PMProjectState', PMProjectStateSchema);
