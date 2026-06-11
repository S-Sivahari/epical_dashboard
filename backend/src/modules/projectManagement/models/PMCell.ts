import { Schema, model, Document, Types } from 'mongoose';

export interface PMCell extends Document {
  projectId: Types.ObjectId; // Direct project reference for easier queries
  libraryId: Types.ObjectId;
  name: string;
  viewType: 'Schematic' | 'Symbol' | 'Layout'; // IMMUTABLE after creation
  checklistType: 'Block' | 'IO' | 'ESD' | 'TOP';
  progress: number;
  status: 'Not Started' | 'In Progress' | 'Submitted For Review' | 'Completed' | 'Rejected';
  isArchived: boolean;
  createdBy: string;
  createdByEmployee?: string;
  assignedEmployee?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PMCellSchema = new Schema<PMCell>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    libraryId: { type: Schema.Types.ObjectId, ref: 'ProjectManagementLibrary', required: true },
    name: { type: String, required: true },
    viewType: { 
      type: String, 
      enum: ['Schematic', 'Symbol', 'Layout'], 
      required: true,
      immutable: true // Prevents modification after creation
    },
    checklistType: { type: String, enum: ['Block', 'IO', 'ESD', 'TOP'], required: true },
    progress: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['Not Started', 'In Progress', 'Submitted For Review', 'Completed', 'Rejected'],
      default: 'Not Started',
    },
    isArchived: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
    createdByEmployee: { type: String },
    assignedEmployee: { type: String },
  },
  { timestamps: true }
);

// Indexes for performance
PMCellSchema.index({ projectId: 1, isArchived: 1 });
PMCellSchema.index({ libraryId: 1, isArchived: 1 });
PMCellSchema.index({ name: 1 });
PMCellSchema.index({ viewType: 1 });
PMCellSchema.index({ assignedEmployee: 1 });
PMCellSchema.index({ createdByEmployee: 1 });

// Compound unique index: one viewType per cell name per library
PMCellSchema.index({ libraryId: 1, name: 1, viewType: 1 }, { unique: true });

// Validation: Ensure viewType cannot be changed after creation
PMCellSchema.pre('save', function(next) {
  if (!this.isNew && this.isModified('viewType')) {
    return next(new Error('ViewType cannot be changed after cell creation. ViewType is immutable.'));
  }
  next();
});

export const PMCellModel = model<PMCell>('ProjectManagementCell', PMCellSchema);
