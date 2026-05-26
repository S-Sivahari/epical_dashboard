import { Schema, model, Document } from 'mongoose';

export interface AutoCheckoutSettings extends Document {
  reminderTime: string;
  autoCheckoutTime: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AutoCheckoutSettingsSchema = new Schema<AutoCheckoutSettings>(
  {
    reminderTime: { type: String, default: '21:00' },
    autoCheckoutTime: { type: String, default: '00:00' },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const AutoCheckoutSettingsModel = model<AutoCheckoutSettings>(
  'AutoCheckoutSettings',
  AutoCheckoutSettingsSchema
);
