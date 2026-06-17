import { Schema, model, Document, Types } from 'mongoose';

export interface NotesDelegationActor {
  id: string;
  name: string;
  email?: string;
}

export interface NotesDelegationDocument extends Document {
  date: string;
  employeeId: string;
  employeeName: string;
  assignedBy: NotesDelegationActor;
  createdAt: Date;
  updatedAt: Date;
}

const notesDelegationSchema = new Schema<NotesDelegationDocument>(
  {
    date: { type: String, required: true, trim: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    employeeId: { type: String, required: true, trim: true, index: true },
    employeeName: { type: String, required: true, trim: true },
    assignedBy: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      email: { type: String, trim: true },
    },
  },
  { timestamps: true },
);

notesDelegationSchema.index({ date: 1 }, { unique: true });

export const NotesDelegationModel = model<NotesDelegationDocument>(
  'NotesDelegation',
  notesDelegationSchema,
);
