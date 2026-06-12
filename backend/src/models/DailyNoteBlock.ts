import { Schema, model, Document, Types } from 'mongoose';

export type DailyNoteStatus = 'draft' | 'in_progress' | 'completed' | 'email_sent';

export type NoteEmailDeliveryStatus = 'sent' | 'failed' | 'partial';

export interface NoteEmailDelivery {
  sentBy: NoteActor;
  sentAt: Date;
  recipientCount: number;
  deliveryStatus: NoteEmailDeliveryStatus;
  errorMessage?: string;
}

export interface NoteActor {
  id: string;
  name: string;
}

export interface NoteChildBlock {
  _id?: Types.ObjectId;
  title: string;
  projectId: string;
  projectName: string;
  employeeIds: string[];
  employees: NoteActor[];
  /** @deprecated Legacy single-employee field — migrated on read */
  employeeId?: string;
  /** @deprecated Legacy single-employee field — migrated on read */
  employeeName?: string;
  description: string;
  includeInEmail: boolean;
  sortOrder: number;
  archived: boolean;
  createdBy: NoteActor;
  updatedBy: NoteActor;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DailyNoteBlockDocument extends Document {
  date: string;
  name: string;
  status: DailyNoteStatus;
  archived: boolean;
  childBlocks: NoteChildBlock[];
  lastEmailDelivery?: NoteEmailDelivery;
  createdBy: NoteActor;
  updatedBy: NoteActor;
  createdAt: Date;
  updatedAt: Date;
}

const noteActorSchema = new Schema<NoteActor>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const noteChildBlockSchema = new Schema<NoteChildBlock>(
  {
    title: { type: String, required: true, trim: true },
    projectId: { type: String, default: '', trim: true },
    projectName: { type: String, default: '', trim: true },
    employeeIds: { type: [String], default: [] },
    employees: { type: [noteActorSchema], default: [] },
    employeeId: { type: String, default: '', trim: true },
    employeeName: { type: String, default: '', trim: true },
    description: { type: String, default: '' },
    includeInEmail: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    archived: { type: Boolean, default: false },
    createdBy: { type: noteActorSchema, required: true },
    updatedBy: { type: noteActorSchema, required: true },
  },
  { timestamps: true },
);

const dailyNoteBlockSchema = new Schema<DailyNoteBlockDocument>(
  {
    date: { type: String, required: true, trim: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['draft', 'in_progress', 'completed', 'email_sent'],
      default: 'draft',
    },
    archived: { type: Boolean, default: false },
    childBlocks: { type: [noteChildBlockSchema], default: [] },
    lastEmailDelivery: {
      type: {
        sentBy: { type: noteActorSchema, required: true },
        sentAt: { type: Date, required: true },
        recipientCount: { type: Number, required: true },
        deliveryStatus: { type: String, enum: ['sent', 'failed', 'partial'], required: true },
        errorMessage: { type: String },
      },
      required: false,
      _id: false,
    },
    createdBy: { type: noteActorSchema, required: true },
    updatedBy: { type: noteActorSchema, required: true },
  },
  { timestamps: true },
);

dailyNoteBlockSchema.index({ date: 1 }, { unique: true });
dailyNoteBlockSchema.index({ archived: 1, date: 1 });
dailyNoteBlockSchema.index({ status: 1, date: -1 });
dailyNoteBlockSchema.index({ 'childBlocks.projectId': 1, date: -1 });
dailyNoteBlockSchema.index({ 'childBlocks.employeeIds': 1, date: -1 });

export const DailyNoteBlockModel = model<DailyNoteBlockDocument>(
  'DailyNoteBlock',
  dailyNoteBlockSchema,
);
