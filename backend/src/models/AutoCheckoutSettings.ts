import { Schema, model, Document } from 'mongoose';

export interface AutoCheckoutSettings extends Document {
  /** Warning email time (HH:mm), sent to anyone still checked in ahead of the intermediate checkout. */
  reminderTime: string;
  /** Intermediate auto-checkout time (HH:mm) — applies only to sessions checked in before this time. */
  intermediateCheckoutTime: string;
  /** Final fallback auto-checkout time (HH:mm) — applies to sessions checked in at/after intermediateCheckoutTime. */
  autoCheckoutTime: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AutoCheckoutSettingsSchema = new Schema<AutoCheckoutSettings>(
  {
    reminderTime: { type: String, default: '20:25' },
    intermediateCheckoutTime: { type: String, default: '20:30' },
    autoCheckoutTime: { type: String, default: '23:59' },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const AutoCheckoutSettingsModel = model<AutoCheckoutSettings>(
  'AutoCheckoutSettings',
  AutoCheckoutSettingsSchema
);
