import { Schema, model, Document, Types } from 'mongoose';

export interface ArchivedProject extends Document {
  originalProjectId: Types.ObjectId;
  projectName: string;
  clientName: string;
  technologyNode: string;
  accessType: 'public' | 'private';
  allowedUsers: string[];
  teamLead?: string;
  description: string;
  status: 'Active' | 'Completed' | 'Rejected';
  completedTasks: number;
  totalTasks: number;
  completionPercentage: number;
  createdBy?: string;
  originalCreatedAt: Date;
  originalUpdatedAt: Date;
  archivedAt: Date;
  assignedTasks: any[];
  timesheets: any[];
}

const ArchivedProjectSchema = new Schema<ArchivedProject>(
  {
    originalProjectId: { type: Schema.Types.ObjectId, required: true },
    projectName: { type: String, required: true },
    clientName: { type: String, required: true },
    technologyNode: { type: String, required: true },
    accessType: { type: String, enum: ['public', 'private'], required: true },
    allowedUsers: { type: [String], default: [] },
    teamLead: { type: String },
    description: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Completed', 'Rejected'], default: 'Active' },
    completedTasks: { type: Number, default: 0 },
    totalTasks: { type: Number, default: 0 },
    completionPercentage: { type: Number, default: 0 },
    createdBy: { type: String },
    originalCreatedAt: { type: Date, required: true },
    originalUpdatedAt: { type: Date, required: true },
    archivedAt: { type: Date, default: Date.now },
    assignedTasks: { type: [Schema.Types.Mixed] as any, default: [] },
    timesheets: { type: [Schema.Types.Mixed] as any, default: [] },
  },
  { timestamps: true }
);

export const ArchivedProjectModel = model<ArchivedProject>('ArchivedProject', ArchivedProjectSchema);
