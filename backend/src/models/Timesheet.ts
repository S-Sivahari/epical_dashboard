import { Schema, model, Document } from 'mongoose';

export interface Timesheet extends Document {
  employee: string; // Employee Name
  employeeId?: string; // Employee ID
  project: string;
  client?: string;
  technologyNode?: string;
  loginTime: Date;
  logoutTime?: Date;
  totalHours?: number;
  correctionRequest?: {
    requestedLogin: Date;
    requestedLogout: Date;
    reason: string;
    message: string;
  };
  requestStatus: 'No Request' | 'Pending Review' | 'Corrected' | 'Approved';
  adminNotes?: string;
  status: 'Approved' | 'Pending' | 'Rejected';
  billable?: boolean;
  task?: string;
  overriddenHours?: number;
  createdAt: Date;
}

const TimesheetSchema = new Schema<Timesheet>(
  {
    employee: { type: String, required: true },
    employeeId: { type: String },
    project: { type: String, required: true },
    client: { type: String },
    technologyNode: { type: String },
    loginTime: { type: Date, required: true },
    logoutTime: { type: Date },
    totalHours: { type: Number },
    correctionRequest: {
      requestedLogin: { type: Date },
      requestedLogout: { type: Date },
      reason: { type: String },
      message: { type: String },
    },
    requestStatus: {
      type: String,
      enum: ['No Request', 'Pending Review', 'Corrected', 'Approved'],
      default: 'No Request',
    },
    adminNotes: { type: String },
    status: {
      type: String,
      enum: ['Approved', 'Pending', 'Rejected'],
      default: 'Pending',
    },
    billable: { type: Boolean, default: true },
    task: { type: String },
    overriddenHours: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const TimesheetModel = model<Timesheet>('Timesheet', TimesheetSchema);

