import { Schema, model, Document, Types } from 'mongoose';

export interface AssignedTask extends Document {
  projectId: Types.ObjectId;
  projectName: string;
  clientName: string;
  technologyNode: string;
  employeeId: string;
  employeeName: string;
  title: string;
  description?: string;
  status: 'assigned' | 'in_progress' | 'pending_review' | 'completed';
  timesheetId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AssignedTaskSchema = new Schema<AssignedTask>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    projectName: { type: String, required: true },
    clientName: { type: String, default: '' },
    technologyNode: { type: String, default: '' },
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['assigned', 'in_progress', 'pending_review', 'completed'],
      default: 'assigned',
    },
    timesheetId: { type: Schema.Types.ObjectId, ref: 'Timesheet' },
  },
  { timestamps: true }
);

AssignedTaskSchema.index({ employeeId: 1, status: 1 });

export const AssignedTaskModel = model<AssignedTask>('AssignedTask', AssignedTaskSchema);
