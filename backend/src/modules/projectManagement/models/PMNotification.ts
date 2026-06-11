import { Schema, model, Document } from 'mongoose';

export interface PMNotification extends Document {
  recipientId: string; // references Employee ID or Admin username/email
  recipientType: 'Employee' | 'Admin';
  title: string;
  message: string;
  isRead: boolean;
  relatedData?: {
    viewId?: string;
    cellId?: string;
    libraryId?: string;
    projectId?: string;
    reviewId?: string;
    viewType?: string;
    stage?: string;
    comments?: string;
    correctiveAction?: string;
    returnStage?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PMNotificationSchema = new Schema<PMNotification>(
  {
    recipientId: { type: String, required: true },
    recipientType: { type: String, enum: ['Employee', 'Admin'], required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    relatedData: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

PMNotificationSchema.index({ recipientId: 1, isRead: 1 });
PMNotificationSchema.index({ createdAt: -1 });

export const PMNotificationModel = model<PMNotification>('PMNotification', PMNotificationSchema);
