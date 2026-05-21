import { Schema, model, Document } from 'mongoose';

export interface Project extends Document {
  projectName: string;
  clientName: string;
  technologyNode: string;
  accessType: 'public' | 'private';
  allowedUsers: string[];
  assignedTeamName?: string;
  description: string;
  status: 'Active' | 'Completed';
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<Project>(
  {
    projectName: { type: String, required: true },
    clientName: { type: String, required: true },
    technologyNode: { type: String, required: true },
    accessType: { type: String, enum: ['public', 'private'], required: true },
    allowedUsers: { type: [String], default: [] },
    assignedTeamName: { type: String },
    description: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Completed'], default: 'Active' },
    createdBy: { type: String },
  },
  { timestamps: true }
);

export const ProjectModel = model<Project>('Project', ProjectSchema);
