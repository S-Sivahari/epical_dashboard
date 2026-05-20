import { Collection } from 'mongodb';
import { getDB } from '../config/db';
import { LeaveRequest, CreateLeavePayload } from '../models/Leave';
import { Holiday } from '../models/Holiday';
import { getBusinessDays, calculateBalances } from '../utils/leaveCalculator';

let leaveCollection: Collection<any> | null = null;
let holidayCollection: Collection<any> | null = null;

function getLeaveCol(): Collection<any> {
  if (!leaveCollection) leaveCollection = getDB().collection('leaves');
  return leaveCollection;
}

function getHolidayCol(): Collection<any> {
  if (!holidayCollection) holidayCollection = getDB().collection('holidays');
  return holidayCollection;
}

// ── Leave Requests ──────────────────────────────────────────────

export async function getAllLeaves(employeeId?: string): Promise<LeaveRequest[]> {
  const col = getLeaveCol();
  const query = employeeId ? { employeeId } : {};
  const leaves = await col.find(query).sort({ createdAt: -1 }).toArray();
  return leaves as LeaveRequest[];
}

export async function getLeaveById(id: string): Promise<LeaveRequest | null> {
  const col = getLeaveCol();
  const leave = await col.findOne({ id });
  return leave as LeaveRequest | null;
}

export async function createLeave(payload: CreateLeavePayload): Promise<LeaveRequest> {
  const col = getLeaveCol();
  
  // 1. Fetch holidays
  const holidays = await getAllHolidays();
  
  // 2. Calculate true business days (skip weekends & holidays)
  const actualDays = getBusinessDays(payload.from, payload.to, holidays);
  
  if (actualDays <= 0) {
    throw new Error('Leave request spans across weekends/holidays with 0 effective business days.');
  }

  // 3. Fetch employee balances to validate
  const employeeLeaves = await getAllLeaves(payload.employeeId);
  const balances = calculateBalances(employeeLeaves);
  
  const leaveBalance = balances[payload.type];
  if (leaveBalance && leaveBalance.remaining < actualDays) {
    throw new Error(`Insufficient ${payload.type} balance. Remaining: ${leaveBalance.remaining}, Requested: ${actualDays}`);
  }

  const id = `L-${Date.now()}`;
  const leave: any = {
    ...payload,
    days: actualDays, // Override days with the true calculated days
    id,
    status: 'Pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await col.insertOne(leave);
  return leave as LeaveRequest;
}

export async function getLeaveBalances(employeeId: string) {
  const leaves = await getAllLeaves(employeeId);
  return calculateBalances(leaves);
}

export async function updateLeaveStatus(
  id: string,
  status: 'Approved' | 'Rejected'
): Promise<LeaveRequest | null> {
  const col = getLeaveCol();
  const result = await col.findOneAndUpdate(
    { id },
    { $set: { status, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  return result as LeaveRequest | null;
}

export async function cancelLeave(id: string): Promise<LeaveRequest | null> {
  const col = getLeaveCol();
  const result = await col.findOneAndUpdate(
    { id, status: 'Approved' },
    { $set: { status: 'Cancelled', updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  return result as LeaveRequest | null;
}

export async function deleteLeave(id: string): Promise<boolean> {
  const col = getLeaveCol();
  const result = await col.deleteOne({ id });
  return result.deletedCount > 0;
}

// ── Holidays ────────────────────────────────────────────────────

export async function getAllHolidays(): Promise<Holiday[]> {
  const col = getHolidayCol();
  const holidays = await col.find({}).sort({ date: 1 }).toArray();
  return holidays as Holiday[];
}

export async function getHolidayById(id: string): Promise<Holiday | null> {
  const col = getHolidayCol();
  const holiday = await col.findOne({ id });
  return holiday as Holiday | null;
}

export async function checkDuplicateHoliday(date: string, excludeId?: string): Promise<boolean> {
  const col = getHolidayCol();
  const query: any = { date };
  if (excludeId) {
    query.id = { $ne: excludeId };
  }
  const existing = await col.findOne(query);
  return !!existing;
}

export async function createHoliday(payload: { title: string; date: string; description?: string; type: 'National' | 'Company' | 'Optional' }): Promise<Holiday> {
  const col = getHolidayCol();
  const id = `H-${Date.now()}`;
  const holiday: any = { ...payload, id, createdAt: new Date(), updatedAt: new Date() };
  await col.insertOne(holiday);
  return holiday as Holiday;
}

export async function updateHoliday(id: string, payload: { title?: string; date?: string; description?: string; type?: 'National' | 'Company' | 'Optional' }): Promise<Holiday | null> {
  const col = getHolidayCol();
  const result = await col.findOneAndUpdate(
    { id },
    { $set: { ...payload, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  return result as Holiday | null;
}

export async function deleteHoliday(id: string): Promise<boolean> {
  const col = getHolidayCol();
  const result = await col.deleteOne({ id });
  return result.deletedCount > 0;
}

// ── Seed ────────────────────────────────────────────────────────

export async function seedLeaves(): Promise<void> {
  const col = getLeaveCol();
  const count = await col.countDocuments();
  if (count > 0) return;

  const leaves = [
    {
      id: 'L-501',
      employeeId: 'E-1002',
      employeeName: 'Rahul Verma',
      type: 'Annual',
      from: '2026-05-22',
      to: '2026-05-26',
      days: 3,
      reason: 'Family travel',
      status: 'Pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'L-502',
      employeeId: 'E-1001',
      employeeName: 'Asha Menon',
      type: 'Sick',
      from: '2026-05-12',
      to: '2026-05-13',
      days: 2,
      reason: 'Medical',
      status: 'Approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await col.insertMany(leaves);
}

export async function seedHolidays(): Promise<void> {
  const col = getHolidayCol();
  const count = await col.countDocuments();
  if (count > 0) return;

  const holidays = [
    { id: 'H-1', title: 'Independence Day', date: '2026-08-15', description: 'National holiday celebrating independence', type: 'National', createdAt: new Date(), updatedAt: new Date() },
    { id: 'H-2', title: 'Diwali', date: '2026-11-08', description: 'Festival of lights', type: 'National', createdAt: new Date(), updatedAt: new Date() },
    { id: 'H-3', title: 'Christmas', date: '2026-12-25', description: 'Company holiday', type: 'Company', createdAt: new Date(), updatedAt: new Date() },
    { id: 'H-4', title: 'New Year', date: '2027-01-01', description: 'New Year celebration', type: 'National', createdAt: new Date(), updatedAt: new Date() },
  ];

  await col.insertMany(holidays);
}
