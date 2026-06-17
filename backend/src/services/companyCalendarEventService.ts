import { Collection } from 'mongodb';
import { getDB } from '../config/db';
import type { CompanyCalendarEvent } from '../models/CompanyCalendarEvent';

let calendarEventCollection: Collection<CompanyCalendarEvent> | null = null;
let indexesCreated = false;

async function createIndexes(): Promise<void> {
  try {
    const collection = getDB().collection('company_calendar_events');
    await Promise.all([
      collection.createIndex({ id: 1 }, { unique: true }),
      collection.createIndex({ date: 1 }),
      collection.createIndex({ date: 1, title: 1 }),
    ]);
  } catch (error) {
    console.error('Failed to create company_calendar_events indexes:', error);
  }
}

function getCollection(): Collection<CompanyCalendarEvent> {
  if (!calendarEventCollection) {
    calendarEventCollection = getDB().collection<CompanyCalendarEvent>('company_calendar_events');
    if (!indexesCreated) {
      void createIndexes();
      indexesCreated = true;
    }
  }
  return calendarEventCollection;
}

export async function getAllCompanyCalendarEvents(): Promise<CompanyCalendarEvent[]> {
  const col = getCollection();
  const docs = await col.find({}).sort({ date: 1, title: 1 }).toArray();
  return docs as CompanyCalendarEvent[];
}

export async function createCompanyCalendarEvent(payload: {
  title: string;
  date: string;
  time?: string;
  description?: string;
}): Promise<CompanyCalendarEvent> {
  const col = getCollection();
  const id = `CE-${Date.now()}`;
  const doc: CompanyCalendarEvent = {
    ...payload,
    id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await col.insertOne(doc);
  return doc;
}

export async function getCompanyCalendarEventById(id: string): Promise<CompanyCalendarEvent | null> {
  const col = getCollection();
  const doc = await col.findOne({ id });
  return doc ?? null;
}

export async function updateCompanyCalendarEvent(
  id: string,
  payload: {
    title?: string;
    date?: string;
    time?: string;
    description?: string;
  },
): Promise<CompanyCalendarEvent | null> {
  const col = getCollection();
  const existing = await col.findOne({ id });
  if (!existing) return null;

  const update: Partial<CompanyCalendarEvent> = { updatedAt: new Date() };
  if (payload.title !== undefined) update.title = payload.title.trim();
  if (payload.date !== undefined) update.date = payload.date.trim();
  if (payload.time !== undefined) update.time = payload.time.trim() || undefined;
  if (payload.description !== undefined) update.description = payload.description.trim() || undefined;

  await col.updateOne({ id }, { $set: update });
  return { ...existing, ...update } as CompanyCalendarEvent;
}

export async function deleteCompanyCalendarEvent(id: string): Promise<boolean> {
  const col = getCollection();
  const result = await col.deleteOne({ id });
  return result.deletedCount > 0;
}
