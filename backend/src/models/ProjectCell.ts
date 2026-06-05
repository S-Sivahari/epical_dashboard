import { Schema, model, Document, Types } from 'mongoose';

export const CELL_TYPES = [
  'Inverter',
  'Current Mirror',
  'Differential Pair',
  'Comparator',
  'Bandgap',
  'OTA',
  'Other',
] as const;

export const CELL_STATUSES = [
  'not_started',
  'in_progress',
  'drc',
  'lvs',
  'review',
  'completed',
  'blocked',
] as const;

export type CellStatus = (typeof CELL_STATUSES)[number];
export type CellType = (typeof CELL_TYPES)[number];

export interface CellActivityEntry {
  action: string;
  detail?: string;
  userId?: string;
  userName?: string;
  at: Date;
}

export interface CellViews {
  layout: string;
  symbol: string;
  schematic: string;
}

export interface ProjectCell extends Document {
  projectId: Types.ObjectId;
  libraryId: Types.ObjectId;
  name: string;
  description: string;
  cellType: CellType;
  technologyNode: string;
  complexity: 'Low' | 'Medium' | 'High';
  estimatedEffort: number;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  dependencyCellIds: Types.ObjectId[];
  status: CellStatus;
  views: CellViews;
  activityLog: CellActivityEntry[];
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectCellSchema = new Schema<ProjectCell>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    libraryId: { type: Schema.Types.ObjectId, ref: 'ProjectLibrary', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    cellType: { type: String, enum: CELL_TYPES, default: 'Other' },
    technologyNode: { type: String, default: '' },
    complexity: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    estimatedEffort: { type: Number, default: 0 },
    assignedEmployeeId: { type: String },
    assignedEmployeeName: { type: String },
    dependencyCellIds: [{ type: Schema.Types.ObjectId, ref: 'ProjectCell' }],
    status: { type: String, enum: CELL_STATUSES, default: 'not_started' },
    views: {
      layout: { type: String, default: '' },
      symbol: { type: String, default: '' },
      schematic: { type: String, default: '' },
    },
    activityLog: [
      {
        action: { type: String, required: true },
        detail: { type: String },
        userId: { type: String },
        userName: { type: String },
        at: { type: Date, default: Date.now },
      },
    ],
    createdBy: { type: String },
  },
  { timestamps: true },
);

ProjectCellSchema.index({ projectId: 1, libraryId: 1 });

export const ProjectCellModel = model<ProjectCell>('ProjectCell', ProjectCellSchema);
