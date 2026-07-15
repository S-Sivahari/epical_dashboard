import { Schema, model, Types, Document } from 'mongoose';

export type MetalConnectionType = 'series' | 'parallel';

export interface MetalEntrySubdoc {
  _id: Types.ObjectId;
  metalType: string;
  width: number;
  length: number;
  pdkModuleId: Types.ObjectId;
  pdkModuleName: string;
  givenCurrentDensity: number;
  schematicCurrentDensity?: number;
  sheetResistance: number;
  implementedCurrentMetalCapacity: number;
  routingMetalImpedance: number;
  connectionType?: MetalConnectionType;
}

export interface MetalRoutingAnalysisDocument extends Document {
  projectId: Types.ObjectId;
  signal: string;
  fromCell: string;
  toCell: string;
  /** Schematic current density (mA/µm) for this signal route — applied to all metals as Given J */
  schematicCurrentDensity?: number;
  /** @deprecated legacy — use `signal` */
  fromSignal?: string;
  /** @deprecated legacy — use `signal` */
  toSignal?: string;
  metals: MetalEntrySubdoc[];
  minimumMetalCurrentCapacity: number;
  totalImpedance: number;
  minCapacityMetalId?: Types.ObjectId | null;
  highestImpedanceMetalId?: Types.ObjectId | null;
  createdBy?: string;
  createdByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const metalEntrySchema = new Schema<MetalEntrySubdoc>(
  {
    metalType: { type: String, required: true, trim: true },
    width: { type: Number, required: true, min: 0 },
    length: { type: Number, required: true, min: 0 },
    pdkModuleId: { type: Schema.Types.ObjectId, ref: 'PdkModule', required: true },
    pdkModuleName: { type: String, required: true, trim: true },
    givenCurrentDensity: { type: Number, required: true, min: 0 },
    schematicCurrentDensity: { type: Number, min: 0 },
    sheetResistance: { type: Number, required: true, min: 0 },
    implementedCurrentMetalCapacity: { type: Number, required: true, min: 0 },
    routingMetalImpedance: { type: Number, required: true, min: 0 },
    connectionType: { type: String, enum: ['series', 'parallel'] },
  },
  { _id: true },
);

const metalRoutingAnalysisSchema = new Schema<MetalRoutingAnalysisDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    signal: { type: String, trim: true, default: '' },
    fromCell: { type: String, required: true, trim: true },
    toCell: { type: String, required: true, trim: true },
    schematicCurrentDensity: { type: Number, min: 0 },
    fromSignal: { type: String, trim: true, default: '' },
    toSignal: { type: String, trim: true, default: '' },
    metals: { type: [metalEntrySchema], default: [] },
    minimumMetalCurrentCapacity: { type: Number, default: 0 },
    totalImpedance: { type: Number, default: 0 },
    minCapacityMetalId: { type: Schema.Types.ObjectId, default: null },
    highestImpedanceMetalId: { type: Schema.Types.ObjectId, default: null },
    createdBy: { type: String },
    createdByName: { type: String },
  },
  { timestamps: true },
);

metalRoutingAnalysisSchema.index(
  { projectId: 1, signal: 1, fromCell: 1, toCell: 1 },
  { unique: true, partialFilterExpression: { signal: { $type: 'string', $gt: '' } } },
);

export const MetalRoutingAnalysisModel = model<MetalRoutingAnalysisDocument>(
  'MetalRoutingAnalysis',
  metalRoutingAnalysisSchema,
);
