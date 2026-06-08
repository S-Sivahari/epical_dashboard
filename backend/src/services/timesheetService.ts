import { Collection } from 'mongodb';
import { getDB } from '../config/db';
import { Timesheet as TimesheetEntry } from '../models/Timesheet';

export type CreateTimesheetPayload = any;

let timesheetCollection: Collection<any> | null = null;

function getTimesheetCol(): Collection<any> {
  if (!timesheetCollection) timesheetCollection = getDB().collection('timesheets');
  return timesheetCollection;
}

export async function getAllTimesheets(filters?: {
  employeeId?: string;
  project?: string;
  from?: string;
  to?: string;
}): Promise<TimesheetEntry[]> {
  const col = getTimesheetCol();
  const query: any = {};

  if (filters?.employeeId) query.employeeId = filters.employeeId;
  if (filters?.project && filters.project !== 'all') query.project = filters.project;
  if (filters?.from || filters?.to) {
    query.date = {};
    if (filters.from) query.date.$gte = filters.from;
    if (filters.to) query.date.$lte = filters.to;
  }

  const entries = await col.find(query).sort({ date: -1 }).toArray();
  return entries as TimesheetEntry[];
}

export async function getTimesheetById(id: string): Promise<TimesheetEntry | null> {
  const col = getTimesheetCol();
  return (await col.findOne({ id })) as TimesheetEntry | null;
}

export async function createTimesheetEntry(
  payload: CreateTimesheetPayload
): Promise<TimesheetEntry> {
  const col = getTimesheetCol();
  const id = `TS-${Date.now()}`;
  const entry: any = {
    ...payload,
    id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await col.insertOne(entry);
  return entry as TimesheetEntry;
}

export async function updateTimesheetEntry(
  id: string,
  payload: Partial<CreateTimesheetPayload>
): Promise<TimesheetEntry | null> {
  const col = getTimesheetCol();
  const result = await col.findOneAndUpdate(
    { id },
    { $set: { ...payload, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  return result as TimesheetEntry | null;
}

export async function deleteTimesheetEntry(id: string): Promise<boolean> {
  const col = getTimesheetCol();
  const result = await col.deleteOne({ id });
  return result.deletedCount > 0;
}
