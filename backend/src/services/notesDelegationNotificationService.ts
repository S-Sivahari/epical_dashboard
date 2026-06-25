import { getDB } from '../config/db';
import { env } from '../config/env';
import { createNotification } from './notificationService';
import { NotesDelegationModel } from '../models/NotesDelegation';
import { formatDailyBlockName } from './notesService';

const NOTES_DELEGATION_TYPE = 'NotesDelegationAssigned' as const;
const NOTES_MORNING_TYPE = 'NotesDelegationMorning' as const;

function todayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, '0');
  const nd = String(date.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

function assignmentMessage(dateKey: string, today: string): { title: string; message: string } {
  const formatted = formatDailyBlockName(dateKey);
  if (dateKey === today) {
    return {
      title: 'Daily notes duty today',
      message: `You are assigned to lead daily notes today (${formatted}). Open Daily Notes when you are ready.`,
    };
  }
  if (dateKey === addDaysToDateKey(today, 1)) {
    return {
      title: 'Daily notes duty tomorrow',
      message: `You are assigned to lead daily notes tomorrow (${formatted}).`,
    };
  }
  return {
    title: 'Daily notes duty scheduled',
    message: `You are assigned to lead daily notes on ${formatted}.`,
  };
}

function morningMessage(dateKey: string): { title: string; message: string } {
  const formatted = formatDailyBlockName(dateKey);
  return {
    title: 'Daily notes duty today',
    message: `Reminder: you are leading daily notes today (${formatted}). Open Daily Notes to prepare and send.`,
  };
}

export async function cancelDelegationNotifications(delegationId: string, employeeId: string) {
  const col = getDB().collection('notifications');
  await col.deleteMany({
    recipientId: employeeId,
    type: { $in: [NOTES_DELEGATION_TYPE, NOTES_MORNING_TYPE] },
    'relatedData.notesDelegationId': delegationId,
  });
}

export async function notifyDelegationAssigned(delegation: {
  _id: string;
  date: string;
  employeeId: string;
  employeeName: string;
  assignedBy: { id: string; name: string };
}) {
  const today = todayDateKey();
  const { title, message } = assignmentMessage(delegation.date, today);

  await createNotification({
    recipientId: delegation.employeeId,
    recipientType: 'Employee',
    type: NOTES_DELEGATION_TYPE,
    title,
    message,
    relatedData: {
      notesDelegationId: delegation._id,
      notesDate: delegation.date,
      notesNotificationKind: 'assigned',
      assignedByName: delegation.assignedBy.name,
      employeeName: delegation.employeeName,
    },
    relatedId: delegation._id,
  });
}

export async function notifyDelegationMorning(delegation: {
  _id: string;
  date: string;
  employeeId: string;
  employeeName: string;
}) {
  const { title, message } = morningMessage(delegation.date);

  await createNotification({
    recipientId: delegation.employeeId,
    recipientType: 'Employee',
    type: NOTES_MORNING_TYPE,
    title,
    message,
    relatedData: {
      notesDelegationId: delegation._id,
      notesDate: delegation.date,
      notesNotificationKind: 'morning',
      employeeName: delegation.employeeName,
    },
    relatedId: delegation._id,
  });

  await NotesDelegationModel.updateOne(
    { _id: delegation._id },
    { $set: { morningNotifiedAt: new Date() } },
  );
}

export async function processMorningDelegationReminders() {
  const today = todayDateKey();
  const delegations = await NotesDelegationModel.find({
    date: today,
    $or: [{ morningNotifiedAt: { $exists: false } }, { morningNotifiedAt: null }],
  }).lean();

  for (const item of delegations) {
    try {
      await notifyDelegationMorning({
        _id: String(item._id),
        date: String(item.date),
        employeeId: String(item.employeeId),
        employeeName: String(item.employeeName),
      });
    } catch (err) {
      console.error('[NotesDelegation] Morning reminder failed:', err);
    }
  }
}

export function notesDelegationMorningCron(): string {
  return env.testCronTimings ? '* * * * *' : '0 6 * * *';
}
