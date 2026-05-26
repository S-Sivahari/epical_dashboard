import { Collection } from 'mongodb';
import { getDB } from '../config/db';
import type { CompanyCalendarEvent } from '../models/CompanyCalendarEvent';

let calendarEventCollection: Collection<CompanyCalendarEvent> | null = null;

function getCollection(): Collection<CompanyCalendarEvent> {
  if (!calendarEventCollection) {
    calendarEventCollection = getDB().collection<CompanyCalendarEvent>('company_calendar_events');
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

export async function deleteCompanyCalendarEvent(id: string): Promise<boolean> {
  const col = getCollection();
  const result = await col.deleteOne({ id });
  return result.deletedCount > 0;
}
