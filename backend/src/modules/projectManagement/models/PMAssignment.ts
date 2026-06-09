import { Schema, model, Document, Types } from 'mongoose';

export interface PMAssignment extends Document {
  projectId: Types.ObjectId;
  libraryId: Types.ObjectId;
  cellId: Types.ObjectId;
  viewId: Types.ObjectId;
  viewType: 'Schematic' | 'Symbol' | 'Layout';
  employeeId: string; // references Employee's id field
  assignedBy: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PMAssignmentSchema = new Schema<PMAssignment>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    libraryId: { type: Schema.Types.ObjectId, ref: 'ProjectManagementLibrary', required: true },
    cellId: { type: Schema.Types.ObjectId, ref: 'ProjectManagementCell', required: true },
    viewId: { type: Schema.Types.ObjectId, ref: 'ProjectManagementView', required: true },
    viewType: { type: String, enum: ['Schematic', 'Symbol', 'Layout'] },
    employeeId: { type: String, required: true },
    assignedBy: { type: String, required: true },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

PMAssignmentSchema.index({ projectId: 1 });
PMAssignmentSchema.index({ employeeId: 1 });
PMAssignmentSchema.index({ viewId: 1 });
PMAssignmentSchema.index({ cellId: 1 });

export const PMAssignmentModel = model<PMAssignment>('ProjectManagementAssignment', PMAssignmentSchema);
