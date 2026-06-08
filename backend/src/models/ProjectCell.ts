import { Schema, model, Document, Types } from 'mongoose';
import { type CellViewWorkflow } from '../utils/cellWorkflow';

export const CELL_TYPES = ['block', 'IOP', 'ESD', 'TOP'] as const;

export const CELL_STATUSES = ['ready', 'in_progress', 'completed'] as const;

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

export type { CellViewWorkflow };

export interface ProjectCell extends Document {
  projectId: Types.ObjectId;
  libraryId: Types.ObjectId;
  name: string;
  description: string;
  cellType: string;
  technologyNode: string;
  complexity: 'Low' | 'Medium' | 'High';
  estimatedEffort: number;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  dependencyCellIds: Types.ObjectId[];
  status: string;
  views: CellViews;
  viewWorkflow: CellViewWorkflow;
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
    cellType: { type: String, default: 'block' },
    technologyNode: { type: String, default: '' },
    complexity: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    estimatedEffort: { type: Number, default: 0 },
    assignedEmployeeId: { type: String },
    assignedEmployeeName: { type: String },
    dependencyCellIds: [{ type: Schema.Types.ObjectId, ref: 'ProjectCell' }],
    status: { type: String, default: 'ready' },
    views: {
      layout: { type: String, default: '' },
      symbol: { type: String, default: '' },
      schematic: { type: String, default: '' },
    },
    viewWorkflow: {
      style: {
        status: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' },
      },
      symbol: {
        status: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' },
      },
      layout: {
        stage: {
          type: String,
          enum: ['floor_plan', 'drc_r1', 'routing', 'drc', 'lvs_r2'],
          default: 'floor_plan',
        },
        status: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' },
        pendingReview: { type: String, enum: ['r1', 'r2', null], default: null },
      },
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
ProjectCellSchema.index({ projectId: 1, name: 1 });

export const ProjectCellModel = model<ProjectCell>('ProjectCell', ProjectCellSchema);
