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

function normalizeDate(date: string) {
  return new Date(date).toISOString().slice(0, 10);
}

export async function createLeave(payload: CreateLeavePayload): Promise<LeaveRequest> {
  const col = getLeaveCol();

  // 1. Fetch holidays (exclude skipped ones — they are working days)
  const allHolidays = await getAllHolidays();
  const holidays = allHolidays.filter((h) => !h.skipped);

  // 2. Calculate true business days (skip weekends & non-skipped holidays)
  const actualBusinessDays = getBusinessDays(payload.from, payload.to, holidays);

  if (payload.leaveDuration === 'Half Day') {
    if (normalizeDate(payload.from) !== normalizeDate(payload.to)) {
      throw new Error('Half-day leave must be for a single date');
    }
    if (actualBusinessDays !== 1) {
      throw new Error('Half-day leave request must fall on a working day');
    }
  } else {
    if (actualBusinessDays <= 0) {
      throw new Error('Leave request spans across weekends/holidays with 0 effective business days.');
    }
  }

  const requestedDays = payload.leaveDuration === 'Half Day' ? 0.5 : actualBusinessDays;

  // 3. Fetch employee balances to validate (pass joinedAt for accurate earned leave)
  const employeeLeaves = await getAllLeaves(payload.employeeId);
  const employeeDoc = await getDB().collection('employees').findOne({ id: payload.employeeId });
  const balances = calculateBalances(employeeLeaves, employeeDoc?.joinedAt as string | undefined);
  
  const leaveBalance = balances[payload.type];
  if (leaveBalance && leaveBalance.remaining < requestedDays) {
    throw new Error(`Insufficient ${payload.type} balance. Remaining: ${leaveBalance.remaining}, Requested: ${requestedDays}`);
  }

  const id = `L-${Date.now()}`;
  const leave: any = {
    ...payload,
    days: requestedDays,
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
  const employee = await getDB().collection('employees').findOne({ id: employeeId });
  return calculateBalances(leaves, employee?.joinedAt as string | undefined);
}

export interface LeaveTypeBalanceSummary {
  type: string;
  total: number;
  used: number;
  pending: number;
  remaining: number;
}

export interface EmployeeLeaveSummary {
  employeeId: string;
  employeeName: string;
  balances: LeaveTypeBalanceSummary[];
  currentLeaves: Array<{
    id: string;
    type: string;
    from: string;
    to: string;
    days: number;
    status: string;
  }>;
  history: LeaveRequest[];
}

function getTodayDateString(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString().split('T')[0];
}

function isApprovedLeaveActiveOnDate(leave: LeaveRequest, dateStr: string): boolean {
  return leave.status === 'Approved' && leave.from <= dateStr && dateStr <= leave.to;
}

export async function getEmployeeLeaveSummary(employeeId: string): Promise<EmployeeLeaveSummary> {
  const leaves = await getAllLeaves(employeeId);
  const balances = calculateBalances(leaves);
  const currentYear = new Date().getFullYear().toString();
  const todayStr = getTodayDateString();

  const pendingByType: Record<string, number> = {};
  leaves.forEach((leave) => {
    if (leave.status === 'Pending' && leave.from.startsWith(currentYear)) {
      pendingByType[leave.type] = (pendingByType[leave.type] || 0) + leave.days;
    }
  });

  const balanceList: LeaveTypeBalanceSummary[] = Object.entries(balances).map(([type, b]) => ({
    type,
    total: b.total,
    used: b.used,
    pending: pendingByType[type] || 0,
    remaining: b.remaining,
  }));

  const currentLeaves = leaves
    .filter((l) => isApprovedLeaveActiveOnDate(l, todayStr))
    .map((l) => ({
      id: l.id,
      type: l.type,
      from: l.from,
      to: l.to,
      days: l.days,
      status: l.status,
    }));

  const employeeName = leaves[0]?.employeeName ?? 'Unknown';

  return {
    employeeId,
    employeeName,
    balances: balanceList,
    currentLeaves,
    history: leaves,
  };
}

export async function updateLeaveStatus(
  id: string,
  status: 'Approved' | 'Rejected',
  rejectionReason?: string,
  actionBy?: string
): Promise<LeaveRequest | null> {
  const col = getLeaveCol();

  // If approving, validate the employee has sufficient balance
  if (status === 'Approved') {
    const leave = await getLeaveById(id);
    if (!leave) return null;

    // Fetch employee leaves to calculate current balance
    const employeeLeaves = await getAllLeaves(leave.employeeId);
    const employeeDoc = await getDB().collection('employees').findOne({ id: leave.employeeId });
    const balances = calculateBalances(employeeLeaves, employeeDoc?.joinedAt as string | undefined);

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

  if (status === 'Approved') {
    updateDoc.approvalDate = new Date();
    updateDoc.approvedAt = new Date();
    if (actionBy) updateDoc.approvedBy = actionBy;
  }

  if (status === 'Rejected') {
    updateDoc.rejectedAt = new Date();
    if (actionBy) updateDoc.rejectedBy = actionBy;
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

export async function cancelLeave(id: string, cancelReason?: string, cancelledBy?: string): Promise<LeaveRequest | null> {
  const col = getLeaveCol();
  const updateFields: any = {
    status: 'Cancelled',
    updatedAt: new Date(),
    cancelledAt: new Date(),
  };
  if (cancelReason) updateFields.cancelReason = cancelReason;
  if (cancelledBy) updateFields.cancelledBy = cancelledBy;

  const result = await col.findOneAndUpdate(
    { id, status: { $in: ['Approved', 'Pending'] } },
    { $set: updateFields },
    { returnDocument: 'after' }
  );

  if (result) {
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

export type HolidayType = 'National' | 'Company' | 'Optional' | 'Company Event'

export async function createHoliday(payload: { title: string; date: string; description?: string; type: HolidayType }): Promise<Holiday> {
  const col = getHolidayCol();
  const id = `H-${Date.now()}`;
  const holiday: any = { ...payload, id, createdAt: new Date(), updatedAt: new Date() };
  await col.insertOne(holiday);
  return holiday as Holiday;
}

export async function updateHoliday(id: string, payload: { title?: string; date?: string; description?: string; type?: HolidayType }): Promise<Holiday | null> {
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
      type: 'National',
      createdAt: new Date(),
      updatedAt: new Date(),
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

// ── Email Notifications ─────────────────────────────────────────

import * as emailService from './emailService';
import { env } from '../config/env';

/**
 * Notify all admins when an employee submits a leave request
 */
export async function notifyAdminsAboutLeaveRequest(leave: LeaveRequest): Promise<void> {
  try {
    const userCollection = getDB().collection('users');
    const admins = await userCollection.find({ role: 'Admin' }).toArray();
    
    for (const admin of admins) {
      await emailService.sendLeaveSubmittedEmail({
        recipientEmail: admin.email,
        recipientName: admin.name,
        employeeName: leave.employeeName,
        type: leave.type,
        from: leave.from,
        to: leave.to,
        days: leave.days,
        reason: leave.reason,
      }, `${env.FRONTEND_URL}/admin/leaves`);
    }
    
    console.log(`[Leave Email] Sent leave request notification to ${admins.length} admin(s)`);
  } catch (error) {
    console.error('[Leave Email] Error sending admin notification:', error);
  }
}

/**
 * Notify employee when their leave status changes (approved/rejected)
 */
export async function notifyEmployeeAboutLeaveStatus(leave: LeaveRequest): Promise<void> {
  try {
    const employeeCollection = getDB().collection('employees');
    const employee = await employeeCollection.findOne({ employeeId: leave.employeeId });
    
    if (!employee || !employee.email) {
      console.warn(`[Leave Email] No email found for employee ${leave.employeeId}`);
      return;
    }
    
    await emailService.sendLeaveStatusEmail({
      recipientEmail: employee.email,
      recipientName: `${employee.firstName} ${employee.lastName}`,
      employeeName: leave.employeeName,
      type: leave.type,
      from: leave.from,
      to: leave.to,
      days: leave.days,
      status: leave.status,
      rejectionReason: leave.rejectionReason,
    }, `${env.FRONTEND_URL}/employee/leaves`);
    
    console.log(`[Leave Email] Sent ${leave.status} notification to ${employee.email}`);
  } catch (error) {
    console.error('[Leave Email] Error sending employee notification:', error);
  }
}
