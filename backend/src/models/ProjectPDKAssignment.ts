import { Schema, model, Document, Types } from 'mongoose';

export interface ProjectPDKAssignmentDocument extends Document {
  projectId: Types.ObjectId;
  pdkModuleId: Types.ObjectId;
  assignedBy?: string;
  assignedAt: Date;
  notes?: string;
}

const projectPDKAssignmentSchema = new Schema<ProjectPDKAssignmentDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
    pdkModuleId: { type: Schema.Types.ObjectId, ref: 'PDKModule', required: true },
    assignedBy: { type: String },
    assignedAt: { type: Date, default: Date.now },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

export const ProjectPDKAssignmentModel = model<ProjectPDKAssignmentDocument>(
  'ProjectPDKAssignment',
  projectPDKAssignmentSchema
);
