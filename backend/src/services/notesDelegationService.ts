import { NotesDelegationModel, type NotesDelegationActor } from '../models/NotesDelegation';
import { getDB } from '../config/db';
import { assertDateKey, enumerateDateKeys } from '../utils/notesSearchUtils';
import {
  cancelDelegationNotifications,
  notifyDelegationAssigned,
} from './notesDelegationNotificationService';

function todayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function skipMorningReminderForDate(date: string): boolean {
  return date === todayDateKey();
}

function assertValidDateKey(date: string): string {
  return assertDateKey(date, 'date');
}
async function resolveEmployeeName(employeeId: string): Promise<{ id: string; name: string }> {
  const trimmed = employeeId.trim();
  if (!trimmed) {
    throw Object.assign(new Error('employeeId is required'), { status: 400 });
  }

  const col = getDB().collection('employees');
  const employee = await col.findOne({
    $or: [{ id: trimmed }, { employeeId: trimmed.toUpperCase() }, { employeeId: trimmed }],
  });

  if (!employee) {
    throw Object.assign(new Error('Employee not found'), { status: 404 });
  }

  const id = String(employee.id ?? employee.employeeId ?? trimmed);
  const name = String(
    employee.name
      ?? [employee.firstName, employee.lastName].filter(Boolean).join(' ')
      ?? employee.employeeId
      ?? id,
  ).trim();

  return { id, name };
}

function serializeDelegation(doc: Record<string, unknown>) {
  return {
    _id: String(doc._id),
    date: String(doc.date),
    employeeId: String(doc.employeeId),
    employeeName: String(doc.employeeName),
    assignedBy: doc.assignedBy as NotesDelegationActor,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listNotesDelegations(from?: string, to?: string) {
  const filter: Record<string, unknown> = {};
  if (from || to) {
    filter.date = {};
    if (from) (filter.date as Record<string, string>).$gte = assertValidDateKey(from);
    if (to) (filter.date as Record<string, string>).$lte = assertValidDateKey(to);
  }

  const items = await NotesDelegationModel.find(filter).sort({ date: 1 }).lean();
  return items.map((item) => serializeDelegation(item as unknown as Record<string, unknown>));
}

export async function listDelegationsForEmployee(employeeId: string, from?: string, to?: string) {
  const filter: Record<string, unknown> = { employeeId: employeeId.trim() };
  if (from || to) {
    filter.date = {};
    if (from) (filter.date as Record<string, string>).$gte = assertValidDateKey(from);
    if (to) (filter.date as Record<string, string>).$lte = assertValidDateKey(to);
  }

  const items = await NotesDelegationModel.find(filter).sort({ date: 1 }).lean();
  return items.map((item) => serializeDelegation(item as unknown as Record<string, unknown>));
}

async function replaceExistingDelegationForDate(date: string) {
  const existing = await NotesDelegationModel.findOne({ date }).lean();
  if (!existing) return;
  await cancelDelegationNotifications(String(existing._id), String(existing.employeeId));
  await NotesDelegationModel.deleteOne({ _id: existing._id });
}

export async function createNotesDelegationsForRange(input: {
  from: string;
  to: string;
  employeeId: string;
  assignedBy: NotesDelegationActor;
}) {
  const from = assertValidDateKey(input.from);
  const to = assertValidDateKey(input.to);
  const dates = enumerateDateKeys(from, to);
  const employee = await resolveEmployeeName(input.employeeId);

  for (const date of dates) {
    await replaceExistingDelegationForDate(date);
  }

  try {
    const created = await NotesDelegationModel.insertMany(
      dates.map((date) => ({
        date,
        employeeId: employee.id,
        employeeName: employee.name,
        assignedBy: input.assignedBy,
        ...(skipMorningReminderForDate(date) ? { morningNotifiedAt: new Date() } : {}),
      })),
    );
    const serialized = created.map((item) =>
      serializeDelegation(item.toObject() as unknown as Record<string, unknown>),
    );
    await Promise.all(
      serialized.map((item) =>
        notifyDelegationAssigned({
          _id: item._id,
          date: item.date,
          employeeId: item.employeeId,
          employeeName: item.employeeName,
          assignedBy: item.assignedBy,
        }),
      ),
    );
    return serialized;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('duplicate key')) {
      throw Object.assign(
        new Error('One or more dates in this range are already assigned'),
        { status: 409 },
      );
    }
    throw err;
  }
}

export async function createNotesDelegation(input: {
  date: string;
  employeeId: string;
  assignedBy: NotesDelegationActor;
}) {
  const date = assertValidDateKey(input.date);
  const employee = await resolveEmployeeName(input.employeeId);

  await replaceExistingDelegationForDate(date);

  try {
    const created = await NotesDelegationModel.create({
      date,
      employeeId: employee.id,
      employeeName: employee.name,
      assignedBy: input.assignedBy,
      ...(skipMorningReminderForDate(date) ? { morningNotifiedAt: new Date() } : {}),
    });
    const serialized = serializeDelegation(created.toObject() as unknown as Record<string, unknown>);
    await notifyDelegationAssigned({
      _id: serialized._id,
      date: serialized.date,
      employeeId: serialized.employeeId,
      employeeName: serialized.employeeName,
      assignedBy: serialized.assignedBy,
    });
    return serialized;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('duplicate key')) {
      throw Object.assign(
        new Error(`Notes for ${date} are already assigned to another employee`),
        { status: 409 },
      );
    }
    throw err;
  }
}

export async function deleteNotesDelegation(id: string) {
  const removed = await NotesDelegationModel.findByIdAndDelete(id).lean();
  if (!removed) {
    throw Object.assign(new Error('Delegation not found'), { status: 404 });
  }
  const serialized = serializeDelegation(removed as unknown as Record<string, unknown>);
  await cancelDelegationNotifications(serialized._id, serialized.employeeId);
  return serialized;
}

export async function isEmployeeDelegatedForDate(employeeId: string, date: string): Promise<boolean> {
  const dateKey = assertValidDateKey(date);
  const match = await NotesDelegationModel.findOne({
    date: dateKey,
    employeeId: employeeId.trim(),
  }).lean();
  return Boolean(match);
}

export async function getEmployeeDelegatedDateKeys(
  employeeId: string,
  from?: string,
  to?: string,
): Promise<string[]> {
  const items = await listDelegationsForEmployee(employeeId, from, to);
  return items.map((item) => item.date);
}
