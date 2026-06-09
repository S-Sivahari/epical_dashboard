import { Schema, model, Document, Types } from 'mongoose';

export interface PdkModuleMetalSpec {
  _id?: Types.ObjectId;
  metalType: string;
  currentDensityAt110: number;
  sheetResistance: number;
}

export interface PdkModuleDocument extends Document {
  name: string;
  technologyNode: string;
  notes: string;
  metals: PdkModuleMetalSpec[];
  createdAt: Date;
  updatedAt: Date;
}

const pdkModuleMetalSchema = new Schema<PdkModuleMetalSpec>(
  {
    metalType: { type: String, required: true, trim: true },
    currentDensityAt110: { type: Number, required: true, min: 0 },
    sheetResistance: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const pdkModuleSchema = new Schema<PdkModuleDocument>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    technologyNode: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
    metals: { type: [pdkModuleMetalSchema], default: [] },
  },
  { timestamps: true },
);

pdkModuleSchema.index({ name: 1 }, { unique: true });

export const PdkModuleModel = model<PdkModuleDocument>('PdkModule', pdkModuleSchema);
