import { Schema, model, Document } from 'mongoose';

export interface EmployeeDailyBreak extends Document {
  employeeId: string;
  date: string;
  morningBreakAt?: Date;
  lunchBreakAt?: Date;
  eveningBreakAt?: Date;
  morningBreakMs?: number;
  lunchBreakMs?: number;
  eveningBreakMs?: number;
  /** Total break time already deducted from project hours today (max 50 min). */
  projectBreakDeductedMs: number;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeDailyBreakSchema = new Schema<EmployeeDailyBreak>(
  {
    employeeId: { type: String, required: true },
    date: { type: String, required: true },
    morningBreakAt: { type: Date },
    lunchBreakAt: { type: Date },
    eveningBreakAt: { type: Date },
    morningBreakMs: { type: Number },
    lunchBreakMs: { type: Number },
    eveningBreakMs: { type: Number },
    projectBreakDeductedMs: { type: Number, default: 0 },
  },
  { timestamps: true },
);

EmployeeDailyBreakSchema.index({ employeeId: 1, date: 1 }, { unique: true });

export const EmployeeDailyBreakModel = model<EmployeeDailyBreak>(
  'EmployeeDailyBreak',
  EmployeeDailyBreakSchema,
);
