import { Schema, model, Document, Types } from 'mongoose';

export interface ReviewHistory extends Document {
  reviewId: Types.ObjectId; // reference to original submission or review id
  viewId: Types.ObjectId;
  viewType: 'Schematic' | 'Symbol' | 'Layout';
  reviewType: 'Standard' | 'Checkpoint 1' | 'Checkpoint 2';
  status: 'Approved' | 'Rejected';
  comments?: string;
  correctiveAction?: string;
  returnStage?: string;
  reviewedBy: string;
  reviewedAt: Date;
}

const ReviewHistorySchema = new Schema<ReviewHistory>(
  {
    reviewId: { type: Schema.Types.ObjectId, required: true },
    viewId: { type: Schema.Types.ObjectId, ref: 'ProjectManagementView', required: true },
    viewType: { type: String, enum: ['Schematic', 'Symbol', 'Layout'], required: true },
    reviewType: { type: String, enum: ['Standard', 'Checkpoint 1', 'Checkpoint 2'], required: true },
    status: { type: String, enum: ['Approved', 'Rejected'], required: true },
    comments: { type: String },
    correctiveAction: { type: String },
    returnStage: { type: String },
    reviewedBy: { type: String, required: true },
    reviewedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

ReviewHistorySchema.index({ viewId: 1, reviewedAt: -1 });

export const ReviewHistoryModel = model<ReviewHistory>('ReviewHistory', ReviewHistorySchema);
