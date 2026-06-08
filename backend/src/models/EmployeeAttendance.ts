import { Schema, model, Document } from 'mongoose';

export type SessionStatus =
  | 'Active'
  | 'Paused'
  | 'Completed'
  | 'Auto Checked-Out'
  | 'Session Incomplete';

export interface EmployeeAttendance extends Document {
  employeeId: string;
  employeeName: string;
  employeeEmail?: string;
  date: string;
  checkInTime: Date;
  checkOutTime?: Date;
  expectedCheckoutTime?: Date;
  autoCheckoutTime?: Date;
  autoCheckoutEnabled: boolean;
  reminderSent: boolean;
  autoCheckedOut: boolean;
  sessionStatus: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeAttendanceSchema = new Schema<EmployeeAttendance>(
  {
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    employeeEmail: { type: String },
    date: { type: String, required: true },
    checkInTime: { type: Date, required: true },
    checkOutTime: { type: Date },
    expectedCheckoutTime: { type: Date },
    autoCheckoutTime: { type: Date },
    autoCheckoutEnabled: { type: Boolean, default: true },
    reminderSent: { type: Boolean, default: false },
    autoCheckedOut: { type: Boolean, default: false },
    sessionStatus: {
      type: String,
      enum: ['Active', 'Paused', 'Completed', 'Auto Checked-Out', 'Session Incomplete'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

EmployeeAttendanceSchema.index({ employeeId: 1, date: 1, checkInTime: -1 });
EmployeeAttendanceSchema.index({ employeeId: 1, checkOutTime: 1 });
EmployeeAttendanceSchema.index({ sessionStatus: 1, checkOutTime: 1 });

export const EmployeeAttendanceModel = model<EmployeeAttendance>(
  'EmployeeAttendance',
  EmployeeAttendanceSchema
);
