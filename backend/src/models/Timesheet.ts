import { Schema, model, Document, Types } from 'mongoose';

export interface Timesheet extends Document {
  employee: string; // Employee Name
  employeeId?: string; // Employee ID
  projectId: Types.ObjectId; // ObjectId ref → Project
  project: string; // Denormalized project name for display
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
  requestStatus: 'No Request' | 'Pending Review' | 'Corrected' | 'Approved' | 'Rejected';
  approvalStatus: 'Pending' | 'Approved' | 'Rejected';
  adminNotes?: string;
  status: 'Approved' | 'Pending' | 'Rejected';
  billable?: boolean;
  task?: string;
  overriddenHours?: number;
  taskStatus?: 'Pending' | 'In Progress' | 'Completed' | 'Session Incomplete';
  createdAt: Date;
}

const TimesheetSchema = new Schema<Timesheet>(
  {
    employee: { type: String, required: true },
    employeeId: { type: String },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
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
      enum: ['No Request', 'Pending Review', 'Corrected', 'Approved', 'Rejected'],
      default: 'No Request',
    },
    approvalStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
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
    taskStatus: {
      type: String,
      enum: ['Pending', 'In Progress', 'Completed', 'Session Incomplete'],
      default: 'Pending',
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const TimesheetModel = model<Timesheet>('Timesheet', TimesheetSchema);
