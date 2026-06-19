import { Schema, model, Document, Types } from 'mongoose';
import { type CellViewWorkflow, type CellWorkflowStage } from '../utils/cellWorkflow';
import type { SchematicWorkflowStage } from '../utils/schematicWorkflow';

export const CELL_TYPES = ['block', 'IO', 'ESD', 'TOP'] as const;

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

export type ChecklistYesNo = 'yes' | 'no';

export interface CellChecklistExtension {
  dimensionX: number | null;
  dimensionY: number | null;
  area: number | null;
  highestMetalUsed: string;
  virtualConnection: ChecklistYesNo | null;
  overallSubstrateContact: ChecklistYesNo | null;
  waivableDrcError: ChecklistYesNo | null;
}

export type { CellViewWorkflow };

export interface ProjectCell extends Document {
  projectId: Types.ObjectId;
  libraryId: Types.ObjectId;
  name: string;
  description: string;
  cellType: string;
  technologyNode: string;
  complexity: 'Simple' | 'Medium' | 'Hard' | 'Critical';
  baseHours: number;
  estimatedEffort: number;
  smartEstimate: number;
  actualEffort: number;
  estimateConfidence: 'High' | 'Low';
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  dependencyCellIds: Types.ObjectId[];
  status: string;
  workflow: CellWorkflowStage[];
  schematicWorkflow: SchematicWorkflowStage[];
  views: CellViews;
  viewWorkflow: CellViewWorkflow;
  checklistExtension?: CellChecklistExtension;
  onHold?: boolean;
  holdStartedAt?: Date;
  holdReason?: string;
  heldById?: string;
  heldByName?: string;
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
    complexity: {
      type: String,
      enum: ['Simple', 'Medium', 'Hard', 'Critical', 'Low', 'High'],
      default: 'Medium',
    },
    baseHours: { type: Number, default: 8 },
    estimatedEffort: { type: Number, default: 0 },
    smartEstimate: { type: Number, default: 0 },
    actualEffort: { type: Number, default: 0 },
    estimateConfidence: { type: String, enum: ['High', 'Low'], default: 'Low' },
    assignedEmployeeId: { type: String },
    assignedEmployeeName: { type: String },
    dependencyCellIds: [{ type: Schema.Types.ObjectId, ref: 'ProjectCell' }],
    status: { type: String, default: 'ready' },
    workflow: [
      {
        stageKey: { type: String, required: true },
        stageLabel: { type: String, required: true },
        status: { type: String, default: 'not_started' },
        updatedAt: { type: Date },
      },
    ],
    schematicWorkflow: [
      {
        stageKey: { type: String, required: true },
        stageLabel: { type: String, required: true },
        status: { type: String, default: 'not_started' },
        updatedAt: { type: Date },
      },
    ],
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
      schematic: {
        stage: {
          type: String,
          enum: ['design', 'simulation', 'data_collection', 'review'],
          default: 'design',
        },
        status: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' },
        pendingReview: { type: Boolean, default: false },
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
    checklistExtension: {
      dimensionX: { type: Number, default: null },
      dimensionY: { type: Number, default: null },
      area: { type: Number, default: null },
      highestMetalUsed: { type: String, default: '' },
      virtualConnection: { type: String, enum: ['yes', 'no', null], default: null },
      overallSubstrateContact: { type: String, enum: ['yes', 'no', null], default: null },
      waivableDrcError: { type: String, enum: ['yes', 'no', null], default: null },
    },
    onHold: { type: Boolean, default: false },
    holdStartedAt: { type: Date },
    holdReason: { type: String, default: '' },
    heldById: { type: String },
    heldByName: { type: String },
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
