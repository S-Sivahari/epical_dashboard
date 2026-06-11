import { Schema, model, Document, Types } from 'mongoose';

export interface Library extends Document {
  name: string;
  projectId: Types.ObjectId;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const LibrarySchema = new Schema<Library>(
  {
    name: { type: String, required: true, trim: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    description: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

export const LibraryModel = model<Library>('Library', LibrarySchema);
