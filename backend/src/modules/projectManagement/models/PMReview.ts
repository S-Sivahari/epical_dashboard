import { Schema, model, Document, Types } from 'mongoose';

export interface PMReview extends Document {
  viewId: Types.ObjectId;
  cellId: Types.ObjectId;
  libraryId: Types.ObjectId;
  projectId: Types.ObjectId;
  viewType: 'Schematic' | 'Symbol' | 'Layout';
  reviewType: 'Standard' | 'Checkpoint 1' | 'Checkpoint 2';
  status: 'Pending' | 'Approved' | 'Rejected';
  comments?: string; // acts as Rejection Reason when status is Rejected
  correctiveAction?: string;
  returnStage?: string;
  submittedBy: string; // employeeId
  reviewedBy?: string; // admin user name/id
  reviewedAt?: Date;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PMReviewSchema = new Schema<PMReview>(
  {
    viewId: { type: Schema.Types.ObjectId, ref: 'ProjectManagementView', required: true },
    cellId: { type: Schema.Types.ObjectId, ref: 'ProjectManagementCell', required: true },
    libraryId: { type: Schema.Types.ObjectId, ref: 'ProjectManagementLibrary', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    viewType: { type: String, enum: ['Schematic', 'Symbol', 'Layout'], required: true },
    reviewType: { type: String, enum: ['Standard', 'Checkpoint 1', 'Checkpoint 2'], required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    comments: { type: String },
    correctiveAction: { type: String },
    returnStage: { type: String },
    submittedBy: { type: String, required: true },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

PMReviewSchema.index({ viewId: 1, isArchived: 1 });
PMReviewSchema.index({ projectId: 1, status: 1 });
PMReviewSchema.index({ submittedBy: 1 });

export const PMReviewModel = model<PMReview>('ProjectManagementReview', PMReviewSchema);
