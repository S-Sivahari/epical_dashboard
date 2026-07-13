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
  morningBreakAt?: Date;
  lunchBreakAt?: Date;
  eveningBreakAt?: Date;
  morningBreakMs?: number;
  lunchBreakMs?: number;
  eveningBreakMs?: number;
  activeBreakType?: 'morning' | 'lunch' | 'evening';
  activeBreakStartedAt?: Date;
  activeBreakEndsAt?: Date;
  breakPausedTimesheetId?: string;
  /** Declared at checkout — affects default break deduction policy. */
  workDayType?: 'half_day' | 'full_day';
  /** Cell to auto-resume on the next project check-in after checkout. */
  resumeProjectId?: string;
  resumeCellId?: string;
  /** Net worked ms for this session (set at checkout; matches timesheet workedMs). */
  sessionWorkedMs?: number;
  /** Default 60m break slice applied on this session (full day, no breaks taken). */
  defaultBreakDeductedMs?: number;
  /** Project pinned when the employee starts a task during this check-in (display fallback). */
  checkedInProjectId?: string;
  checkedInProjectName?: string;
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
    morningBreakAt: { type: Date },
    lunchBreakAt: { type: Date },
    eveningBreakAt: { type: Date },
    morningBreakMs: { type: Number },
    lunchBreakMs: { type: Number },
    eveningBreakMs: { type: Number },
    activeBreakType: { type: String, enum: ['morning', 'lunch', 'evening'] },
    activeBreakStartedAt: { type: Date },
    activeBreakEndsAt: { type: Date },
    breakPausedTimesheetId: { type: String },
    workDayType: { type: String, enum: ['half_day', 'full_day'] },
    resumeProjectId: { type: String },
    resumeCellId: { type: String },
    sessionWorkedMs: { type: Number },
    defaultBreakDeductedMs: { type: Number },
    checkedInProjectId: { type: String },
    checkedInProjectName: { type: String },
  },
  { timestamps: true }
);

EmployeeAttendanceSchema.index({ employeeId: 1, date: 1, checkInTime: -1 });
EmployeeAttendanceSchema.index({ checkInTime: -1 });
EmployeeAttendanceSchema.index({ employeeId: 1, checkOutTime: 1 });
EmployeeAttendanceSchema.index({ sessionStatus: 1, checkOutTime: 1 });

export const EmployeeAttendanceModel = model<EmployeeAttendance>(
  'EmployeeAttendance',
  EmployeeAttendanceSchema
);
