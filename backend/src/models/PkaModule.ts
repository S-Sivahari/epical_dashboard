import { Schema, model, Document, Types } from 'mongoose';

export interface PkaModuleMetalSpec {
  _id?: Types.ObjectId;
  metalType: string;
  currentDensityAt110: number;
  sheetResistance: number;
}

export interface PkaModuleDocument extends Document {
  name: string;
  technologyNode: string;
  notes: string;
  metals: PkaModuleMetalSpec[];
  createdAt: Date;
  updatedAt: Date;
}

const pkaModuleMetalSchema = new Schema<PkaModuleMetalSpec>(
  {
    metalType: { type: String, required: true, trim: true },
    currentDensityAt110: { type: Number, required: true, min: 0 },
    sheetResistance: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const pkaModuleSchema = new Schema<PkaModuleDocument>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    technologyNode: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
    metals: { type: [pkaModuleMetalSchema], default: [] },
  },
  { timestamps: true },
);

pkaModuleSchema.index({ name: 1 }, { unique: true });

export const PkaModuleModel = model<PkaModuleDocument>('PkaModule', pkaModuleSchema);
