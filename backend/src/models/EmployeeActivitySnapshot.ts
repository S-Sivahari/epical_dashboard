import { Schema, model, Document } from 'mongoose';

export interface EmployeeActivitySnapshot extends Document {
  employeeId: string;
  employeeName: string;
  employeeEmail?: string;
  date: string;
  idleMs: number;
  isIdle: boolean;
  idleThresholdMs: number;
  hostname?: string;
  machineId?: string;
  reportedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeActivitySnapshotSchema = new Schema<EmployeeActivitySnapshot>(
  {
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    employeeEmail: { type: String },
    date: { type: String, required: true, index: true },
    idleMs: { type: Number, required: true, min: 0 },
    isIdle: { type: Boolean, required: true },
    idleThresholdMs: { type: Number, required: true, min: 0 },
    hostname: { type: String },
    machineId: { type: String },
    reportedAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

EmployeeActivitySnapshotSchema.index({ employeeId: 1, date: 1, reportedAt: -1 });
EmployeeActivitySnapshotSchema.index({ reportedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const EmployeeActivitySnapshotModel = model<EmployeeActivitySnapshot>(
  'EmployeeActivitySnapshot',
  EmployeeActivitySnapshotSchema
);
