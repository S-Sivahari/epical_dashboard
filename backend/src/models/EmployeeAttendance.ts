import { Schema, model, Document } from 'mongoose';

export interface EmployeeAttendance extends Document {
  employeeId: string;
  employeeName: string;
  date: string;
  checkInTime: Date;
  checkOutTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeAttendanceSchema = new Schema<EmployeeAttendance>(
  {
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    date: { type: String, required: true },
    checkInTime: { type: Date, required: true },
    checkOutTime: { type: Date },
  },
  { timestamps: true }
);

EmployeeAttendanceSchema.index({ employeeId: 1, date: 1 });

export const EmployeeAttendanceModel = model<EmployeeAttendance>(
  'EmployeeAttendance',
  EmployeeAttendanceSchema
);
