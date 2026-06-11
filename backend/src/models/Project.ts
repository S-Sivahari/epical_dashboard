import { Schema, model, Document, Types } from 'mongoose';

export interface Project extends Document {
  projectName: string;
  clientName: string;
  technologyNode: string;
  accessType: 'public' | 'private';
  allowedUsers: string[];
  teamLead?: string;
  description: string;
  status: 'Active' | 'Completed' | 'Rejected' | 'Cancelled';
  completedTasks: number;
  totalTasks: number;
  completionPercentage: number;
  pdkModuleId?: Types.ObjectId | null;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<Project>(
  {
    projectName: { type: String, required: true },
    clientName: { type: String, required: true },
    technologyNode: { type: String, default: '' },
    accessType: { type: String, enum: ['public', 'private'], required: true },
    allowedUsers: { type: [String], default: [] },
    teamLead: { type: String },
    description: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Completed', 'Rejected', 'Cancelled'], default: 'Active' },
    completedTasks: { type: Number, default: 0 },
    totalTasks: { type: Number, default: 0 },
    completionPercentage: { type: Number, default: 0 },
    pdkModuleId: { type: Schema.Types.ObjectId, ref: 'PdkModule', default: null },
    createdBy: { type: String },
  },
  { timestamps: true }
);

export const ProjectModel = model<Project>('Project', ProjectSchema);
