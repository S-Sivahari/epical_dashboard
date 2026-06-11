import { Schema, model, Document } from 'mongoose';

export interface RoutingMasterRowDocument extends Document {
  fromCell: string;
  toCell: string;
  fromSignal: string;
  toSignal: string;
  routeLayer: string;
  viaCount: number;
  maxCurrentMa: number;
  designNotes: string;
  createdAt: Date;
  updatedAt: Date;
}

const routingMasterRowSchema = new Schema<RoutingMasterRowDocument>(
  {
    fromCell: { type: String, required: true, trim: true, index: true },
    toCell: { type: String, required: true, trim: true, index: true },
    fromSignal: { type: String, required: true, trim: true, index: true },
    toSignal: { type: String, required: true, trim: true, index: true },
    routeLayer: { type: String, default: '', trim: true },
    viaCount: { type: Number, default: 0, min: 0 },
    maxCurrentMa: { type: Number, default: 0, min: 0 },
    designNotes: { type: String, default: '', trim: true },
  },
  { timestamps: true },
);

routingMasterRowSchema.index(
  { fromCell: 1, toCell: 1, fromSignal: 1, toSignal: 1 },
);

export const RoutingMasterRowModel = model<RoutingMasterRowDocument>(
  'RoutingMasterRow',
  routingMasterRowSchema,
);
