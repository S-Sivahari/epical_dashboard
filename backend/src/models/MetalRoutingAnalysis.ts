import { Schema, model, Types, Document } from 'mongoose';

export interface MetalEntrySubdoc {
  _id: Types.ObjectId;
  metalType: string;
  width: number;
  length: number;
  pkaModuleId: Types.ObjectId;
  pkaModuleName: string;
  givenCurrentDensity: number;
  sheetResistance: number;
  implementedCurrentMetalCapacity: number;
  routingMetalImpedance: number;
}

export interface MetalRoutingAnalysisDocument extends Document {
  fromCell: string;
  toCell: string;
  fromSignal: string;
  toSignal: string;
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
    pkaModuleId: { type: Schema.Types.ObjectId, ref: 'PkaModule', required: true },
    pkaModuleName: { type: String, required: true, trim: true },
    givenCurrentDensity: { type: Number, required: true, min: 0 },
    sheetResistance: { type: Number, required: true, min: 0 },
    implementedCurrentMetalCapacity: { type: Number, required: true, min: 0 },
    routingMetalImpedance: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const metalRoutingAnalysisSchema = new Schema<MetalRoutingAnalysisDocument>(
  {
    fromCell: { type: String, required: true, trim: true },
    toCell: { type: String, required: true, trim: true },
    fromSignal: { type: String, required: true, trim: true },
    toSignal: { type: String, required: true, trim: true },
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
  { fromCell: 1, toCell: 1, fromSignal: 1, toSignal: 1 },
  { unique: true },
);

export const MetalRoutingAnalysisModel = model<MetalRoutingAnalysisDocument>(
  'MetalRoutingAnalysis',
  metalRoutingAnalysisSchema,
);
