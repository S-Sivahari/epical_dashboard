import { Schema, model, Document, Types } from 'mongoose';

export interface ReviewMessage {
  authorId: string;
  authorName: string;
  authorRole: 'Admin' | 'Employee';
  body: string;
  at: Date;
}

export interface CellReview extends Document {
  projectId: Types.ObjectId;
  cellId: Types.ObjectId;
  stageAtRequest: string;
  status: 'open' | 'resolved';
  initiatedBy: string;
  initiatedByName: string;
  assignedEmployeeId?: string;
  messages: ReviewMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const CellReviewSchema = new Schema<CellReview>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    cellId: { type: Schema.Types.ObjectId, ref: 'ProjectCell', required: true, index: true },
    stageAtRequest: { type: String, required: true },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    initiatedBy: { type: String, required: true },
    initiatedByName: { type: String, required: true },
    assignedEmployeeId: { type: String },
    messages: [
      {
        authorId: { type: String, required: true },
        authorName: { type: String, required: true },
        authorRole: { type: String, enum: ['Admin', 'Employee'], required: true },
        body: { type: String, required: true },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

export const CellReviewModel = model<CellReview>('CellReview', CellReviewSchema);
