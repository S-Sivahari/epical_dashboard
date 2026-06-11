import { Schema, model, Document, Types } from 'mongoose';

export interface CheckpointStatus {
  checkpoint1: 'None' | 'Pending' | 'Approved' | 'Rejected';
  checkpoint2: 'None' | 'Pending' | 'Approved' | 'Rejected';
}

export interface PMView extends Document {
  cellId: Types.ObjectId;
  viewType: 'Schematic' | 'Symbol' | 'Layout';
  status: 'In Progress' | 'Submitted For Review' | 'Completed' | 'Rejected';
  currentStage: string;
  completedStages: string[];
  checkpointStatus: CheckpointStatus;
  reviewStatus: 'None' | 'Pending Checkpoint 1' | 'Pending Checkpoint 2' | 'Approved' | 'Rejected';
  progress: number;
  isArchived: boolean;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CheckpointStatusSchema = new Schema<CheckpointStatus>(
  {
    checkpoint1: { type: String, enum: ['None', 'Pending', 'Approved', 'Rejected'], default: 'None' },
    checkpoint2: { type: String, enum: ['None', 'Pending', 'Approved', 'Rejected'], default: 'None' },
  },
  { _id: false }
);

const PMViewSchema = new Schema<PMView>(
  {
    cellId: { type: Schema.Types.ObjectId, ref: 'ProjectManagementCell', required: true },
    viewType: { type: String, enum: ['Schematic', 'Symbol', 'Layout'], required: true },
    status: {
      type: String,
      enum: ['In Progress', 'Submitted For Review', 'Completed', 'Rejected'],
      default: 'In Progress',
    },
    currentStage: { type: String, default: 'Floor Plan' }, // Starts at Floor Plan for Layout, Design for others
    completedStages: { type: [String], default: [] },
    checkpointStatus: {
      type: CheckpointStatusSchema,
      default: () => ({ checkpoint1: 'None', checkpoint2: 'None' }),
    },
    reviewStatus: {
      type: String,
      enum: ['None', 'Pending Checkpoint 1', 'Pending Checkpoint 2', 'Approved', 'Rejected'],
      default: 'None',
    },
    progress: { type: Number, default: 0 },
    isArchived: { type: Boolean, default: false },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

PMViewSchema.index({ cellId: 1, viewType: 1, isArchived: 1 });
PMViewSchema.index({ status: 1 });

export const PMViewModel = model<PMView>('ProjectManagementView', PMViewSchema);
