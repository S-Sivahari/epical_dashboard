import { Collection } from 'mongodb';
import { getDB } from '../config/db';
import { LeaveRequest, CreateLeavePayload } from '../models/Leave';
import { Holiday } from '../models/Holiday';
import { getBusinessDays, calculateBalances } from '../utils/leaveCalculator';
import * as notificationService from './notificationService';

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

  // Note: No validation against balance here. Admin will validate during approval.
  // This allows employees to request leave freely, and admin reviews it.

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

  // Create notification for manager/admin
  try {
    // Notify all admins
    const userCollection = getDB().collection('users');
    const admins = await userCollection.find({ role: 'Admin' }).toArray();
    console.log(`[Leave Notification] Found ${admins.length} admins to notify`);
    console.log(`[Leave Notification] Admins:`, admins.map((a) => ({ id: a.id, name: a.name })));

    for (const admin of admins) {
      console.log(`[Leave Notification] Creating notification for admin: ${admin.id}`);
      await notificationService.createNotification({
        recipientId: admin.id,
        recipientType: 'Admin',
        type: 'LeaveSubmitted',
        title: 'New Leave Request',
        message: `${payload.employeeName} has submitted a ${payload.type} leave request from ${payload.from} to ${payload.to}`,
        relatedData: {
          leaveId: id,
          employeeId: payload.employeeId,
          employeeName: payload.employeeName,
        },
      });
      console.log(`[Leave Notification] Notification created for admin: ${admin.id}`);
    }
  } catch (error) {
    console.error('Error creating notification for leave submission:', error);
    // Don't throw - notification failure shouldn't break leave creation
  }

  return leave as LeaveRequest;
}

export async function getLeaveBalances(employeeId: string) {
  const leaves = await getAllLeaves(employeeId);
  return calculateBalances(leaves);
}

export async function updateLeaveStatus(
  id: string,
  status: 'Approved' | 'Rejected',
  rejectionReason?: string
): Promise<LeaveRequest | null> {
  const col = getLeaveCol();

  // If approving, validate the employee has sufficient balance
  if (status === 'Approved') {
    const leave = await getLeaveById(id);
    if (!leave) return null;

    // Fetch employee leaves to calculate current balance
    const employeeLeaves = await getAllLeaves(leave.employeeId);
    const balances = calculateBalances(employeeLeaves);

    const leaveBalance = balances[leave.type];
    if (leaveBalance && leaveBalance.remaining < leave.days) {
      throw new Error(
        `Cannot approve: Insufficient ${leave.type} balance. ` +
        `Remaining: ${leaveBalance.remaining}, Requested: ${leave.days}`
      );
    }
  }

  // Build update document
  const updateDoc: any = {
    status,
    updatedAt: new Date(),
  };

  // Add rejection reason if rejecting
  if (status === 'Rejected' && rejectionReason) {
    updateDoc.rejectionReason = rejectionReason;
  }

  const result = await col.findOneAndUpdate(
    { id },
    { $set: updateDoc },
    { returnDocument: 'after' }
  );

  if (result) {
    // Create notification for employee
    try {
      const notificationType = status === 'Approved' ? 'LeaveApproved' : 'LeaveRejected';
      const title = status === 'Approved' ? 'Leave Approved' : 'Leave Rejected';
      const message =
        status === 'Approved'
          ? `Your ${result.type} leave request from ${result.from} to ${result.to} has been approved.`
          : `Your ${result.type} leave request from ${result.from} to ${result.to} has been rejected.`;

      await notificationService.createNotification({
        recipientId: result.employeeId,
        recipientType: 'Employee',
        type: notificationType,
        title,
        message,
        relatedData: {
          leaveId: id,
          employeeId: result.employeeId,
          employeeName: result.employeeName,
        },
      });
    } catch (error) {
      console.error(`Error creating ${status} notification:`, error);
      // Don't throw - notification failure shouldn't break status update
    }
  }

  return result as LeaveRequest | null;
}

export async function cancelLeave(id: string): Promise<LeaveRequest | null> {
  const col = getLeaveCol();
  const result = await col.findOneAndUpdate(
    { id, status: 'Approved' },
    { $set: { status: 'Cancelled', updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  if (result) {
    // Create notification for employee on cancellation
    try {
      await notificationService.createNotification({
        recipientId: result.employeeId,
        recipientType: 'Employee',
        type: 'LeaveCancelled',
        title: 'Leave Cancelled',
        message: `Your ${result.type} leave request from ${result.from} to ${result.to} has been cancelled.`,
        relatedData: {
          leaveId: id,
          employeeId: result.employeeId,
          employeeName: result.employeeName,
        },
      });
    } catch (error) {
      console.error('Error creating cancellation notification:', error);
      // Don't throw - notification failure shouldn't break status update
    }
  }

  return result as LeaveRequest | null;
}

export async function rejectLeaveWithReason(id: string, rejectionReason: string): Promise<LeaveRequest | null> {
  const col = getLeaveCol();
  const result = await col.findOneAndUpdate(
    { id },
    { $set: { status: 'Rejected', rejectionReason, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  if (result) {
    // Create notification for employee on rejection
    try {
      const message = rejectionReason
        ? `Your ${result.type} leave request from ${result.from} to ${result.to} has been rejected. Reason: ${rejectionReason}`
        : `Your ${result.type} leave request from ${result.from} to ${result.to} has been rejected.`;

      await notificationService.createNotification({
        recipientId: result.employeeId,
        recipientType: 'Employee',
        type: 'LeaveRejected',
        title: 'Leave Rejected',
        message,
        relatedData: {
          leaveId: id,
          employeeId: result.employeeId,
          employeeName: result.employeeName,
        },
      });
    } catch (error) {
      console.error('Error creating rejection notification:', error);
      // Don't throw - notification failure shouldn't break status update
    }
  }

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

// ── Fetch from External API ─────────────────────────────────────

export async function fetchIndianHolidaysFromAPI(year: number): Promise<Holiday[]> {
  try {
    const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/IN`);
    if (!response.ok) {
      throw new Error(`Failed to fetch holidays: ${response.statusText}`);
    }
    const data = await response.json();

    // Map API response to Holiday format
    const holidays: Holiday[] = data.map((h: any, index: number) => ({
      id: `H-API-${year}-${index}`,
      title: h.name,
      date: h.date, // Format: YYYY-MM-DD
      createdAt: new Date(),
    }));

    return holidays;
  } catch (error) {
    console.error('Error fetching Indian holidays from API:', error);
    throw error;
  }
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

  try {
    // Fetch Indian holidays from external API
    const currentYear = new Date().getFullYear();
    const holidays2026 = await fetchIndianHolidaysFromAPI(2026);
    const holidays2027 = await fetchIndianHolidaysFromAPI(2027);

    const allHolidays = [...holidays2026, ...holidays2027];

    if (allHolidays.length > 0) {
      await col.insertMany(allHolidays);
      console.log(`Seeded ${allHolidays.length} Indian holidays from API`);
      return;
    }
  } catch (error) {
    console.warn('Could not fetch holidays from API, using fallback holidays');
  }

  // Fallback: If API fails, use default holidays
  const fallbackHolidays = [
    { id: 'H-1', title: 'Independence Day', date: '2026-08-15', createdAt: new Date() },
    { id: 'H-2', title: 'Diwali', date: '2026-11-08', createdAt: new Date() },
    { id: 'H-3', title: 'Christmas', date: '2026-12-25', createdAt: new Date() },
    { id: 'H-4', title: 'New Year', date: '2027-01-01', createdAt: new Date() },
  ];

  await col.insertMany(fallbackHolidays);
}
