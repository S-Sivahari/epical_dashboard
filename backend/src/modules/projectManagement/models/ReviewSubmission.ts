import { Schema, model, Document, Types } from 'mongoose';

export interface ReviewSubmission extends Document {
  viewId: Types.ObjectId;
  cellId: Types.ObjectId;
  viewType: 'Schematic' | 'Symbol' | 'Layout';
  reviewType: 'Standard' | 'Checkpoint 1' | 'Checkpoint 2';
  status: 'Pending' | 'Approved' | 'Rejected';
  submittedBy: string;
  submittedAt: Date;
  checklistResponseId: Types.ObjectId;
}

const ReviewSubmissionSchema = new Schema<ReviewSubmission>(
  {
    viewId: { type: Schema.Types.ObjectId, ref: 'ProjectManagementView', required: true },
    cellId: { type: Schema.Types.ObjectId, ref: 'ProjectManagementCell', required: true },
    viewType: { type: String, enum: ['Schematic', 'Symbol', 'Layout'], required: true },
    reviewType: { type: String, enum: ['Standard', 'Checkpoint 1', 'Checkpoint 2'], required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    submittedBy: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
    checklistResponseId: { type: Schema.Types.ObjectId, ref: 'ChecklistResponse', required: true },
  },
  { timestamps: false }
);

ReviewSubmissionSchema.index({ viewId: 1, status: 1 });

export const ReviewSubmissionModel = model<ReviewSubmission>('ReviewSubmission', ReviewSubmissionSchema);
