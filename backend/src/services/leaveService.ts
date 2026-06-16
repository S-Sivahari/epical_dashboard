import { Collection } from 'mongodb';
import { getDB } from '../config/db';
import { findEmployeeByLoginEmail, findUserForEmployee, resolveEmployeeForAuthUser } from '../utils/employeeAuth';
import { LeaveRequest, CreateLeavePayload } from '../models/Leave';
import { Holiday } from '../models/Holiday';
import {
  getBusinessDays,
  calculateBalances,
  calculateMonthlyLopSummary,
  computeCasualLeaveLopForRequest,
  isCasualSameDayLeave,
  LOP_LEAVE_TYPE,
  leaveMonth,
  LEAVE_ALLOCATIONS,
  resolveLeaveBalanceKey,
  sumPendingLeaveDays,
} from '../utils/leaveCalculator';
import type { Employee } from '../models/Employee';
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
function compensationCol(): Collection<any> {
  return getDB().collection('compensation_entries');
}

/** Collect every id variant stored on leaves / employees / users for one person. */
export async function resolveLeaveEmployeeIds(employeeId: string): Promise<string[]> {
  const trimmed = String(employeeId ?? '').trim();
  const ids = new Set<string>();
  if (trimmed) ids.add(trimmed);

  const employeeCol = getDB().collection('employees');
  const NO_BLOBS_PROJECTION = { projection: { documents: 0, 'photo.data': 0 } };
  const emp =
    (await employeeCol.findOne({ id: trimmed }, NO_BLOBS_PROJECTION)) ||
    (await employeeCol.findOne({ employeeId: trimmed }, NO_BLOBS_PROJECTION)) ||
    (await employeeCol.findOne({ employeeId: trimmed.toUpperCase() }, NO_BLOBS_PROJECTION));

  if (emp?.id) ids.add(String(emp.id));
  if (emp?.employeeId) {
    ids.add(String(emp.employeeId));
    ids.add(String(emp.employeeId).toUpperCase());
  }
  if (emp) {
    const linkedUser = await findUserForEmployee(emp as any);
    if (linkedUser?.id) ids.add(String(linkedUser.id));
  }

  const userCol = getDB().collection('users');
  const user =
    (await userCol.findOne({ id: trimmed })) ||
    (await userCol.findOne({ email: trimmed.toLowerCase() }));
  if (user?.id) ids.add(String(user.id));
  if (user?.email) {
    const empByEmail = await findEmployeeByLoginEmail(String(user.email));
    if (empByEmail?.id) ids.add(String(empByEmail.id));
    if (empByEmail?.employeeId) {
      ids.add(String(empByEmail.employeeId));
      ids.add(String(empByEmail.employeeId).toUpperCase());
    }
  }

  return Array.from(ids);
}

async function findEmployeeDoc(employeeId: string): Promise<Employee | null> {
  const trimmed = String(employeeId ?? '').trim();
  if (!trimmed) return null;

  const userCol = getDB().collection('users');
  const user = await userCol.findOne({ id: trimmed });

  return resolveEmployeeForAuthUser(trimmed, user?.email ? String(user.email) : undefined) as Promise<Employee | null>;
}

function employeeAllocationOverrides(employee: Employee | null | undefined) {
  return employee?.leaveAllocations;
}

/** Sum active admin compensation credits for the calendar year (Compensation Leave balance only). */
export async function getCompensationLeaveCreditsForYear(
  employeeDbId: string,
  calendarYear = new Date().getFullYear(),
): Promise<number> {
  const ids = await resolveLeaveEmployeeIds(employeeDbId);

  const col = compensationCol();
  const entries = await col
    .find({
      status: 'Active',
      employeeId: { $in: ids },
    })
    .toArray();

  const yPrefix = `${calendarYear}`;
  let sum = 0;
  for (const e of entries) {
    const applied = String(e.appliedDate || '').slice(0, 4);
    if (applied !== yPrefix) continue;
    const d = Number(e.days);
    if (!Number.isNaN(d)) sum += d;
  }
  return sum;
}

/** @deprecated Use getCompensationLeaveCreditsForYear */
export async function getCompensationEarnedLeaveBonusForYear(
  employeeDbId: string,
  calendarYear = new Date().getFullYear(),
): Promise<number> {
  return getCompensationLeaveCreditsForYear(employeeDbId, calendarYear);
}

function leaveBalanceOptions(
  employee: Employee | null | undefined,
  compensationLeaveCredits: number,
  refDate = new Date(),
) {
  return {
    compensationLeaveCredits,
    employeeAllocations: employeeAllocationOverrides(employee),
    refDate,
  };
}

// ── Leave Requests ──────────────────────────────────────────────

export async function getAllLeaves(employeeId?: string): Promise<LeaveRequest[]> {
  const col = getLeaveCol();
  if (!employeeId) {
    const leaves = await col.find({}).sort({ createdAt: -1 }).toArray();
    return leaves as LeaveRequest[];
  }
  const ids = await resolveLeaveEmployeeIds(employeeId);
  const leaves = await col.find({ employeeId: { $in: ids } }).sort({ createdAt: -1 }).toArray();
  return leaves as LeaveRequest[];
}

export async function getLeaveById(id: string): Promise<LeaveRequest | null> {
  const col = getLeaveCol();
  const leave = await col.findOne({ id });
  return leave as LeaveRequest | null;
}

function normalizeDate(date: string) {
  const trimmed = String(date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toISOString().slice(0, 10);
}

export async function createLeave(payload: CreateLeavePayload): Promise<LeaveRequest> {
  validateLeaveDates(payload.from, payload.to);

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
  const employeeLeaves = await loadLeavesForBalance(payload.employeeId);
  const employeeDoc = await findEmployeeDoc(payload.employeeId);
  const compCredits = await getCompensationLeaveCreditsForYear(
    employeeDoc?.id ? String(employeeDoc.id) : payload.employeeId,
  );
  const balanceOptions = leaveBalanceOptions(employeeDoc, compCredits);
  const balances = calculateBalances(employeeLeaves, employeeDoc?.joinedAt as string | undefined, balanceOptions);

  const balanceKey = resolveLeaveBalanceKey(payload.type);
  const leaveBalance = balances[balanceKey];
  let lopDays = 0;

  if (payload.type === LOP_LEAVE_TYPE) {
    lopDays = requestedDays;
  } else if (payload.type === 'Sick Leave') {
    const pendingSick = sumPendingLeaveDays(employeeLeaves, 'Sick Leave');
    const availableSick = (leaveBalance?.remaining ?? 0) - pendingSick;
    if (availableSick < requestedDays) {
      throw new Error(
        `Insufficient Sick Leave balance. Remaining: ${Math.max(0, availableSick)}, Requested: ${requestedDays}`,
      );
    }
  } else if (payload.type === 'Casual Leave') {
    if (isCasualSameDayLeave(payload.from)) {
      throw new Error(
        'Casual leave must be applied before your leave date. Please submit same-day leave as LOP.',
      );
    }
    const split = computeCasualLeaveLopForRequest(
      requestedDays,
      employeeLeaves,
      employeeDoc?.joinedAt as string | undefined,
      balanceOptions,
      undefined,
      payload.from,
    );
    if (split.lopDays > 0) {
      const paid = split.paidDays;
      const excess = split.lopDays;
      if (paid <= 0) {
        throw new Error(
          'Your casual leave balance is used up for this month. Please apply as LOP instead.',
        );
      }
      throw new Error(
        `Your request is for ${requestedDays} day${requestedDays === 1 ? '' : 's'} but only ${paid} casual day${paid === 1 ? '' : 's'} ${paid === 1 ? 'is' : 'are'} available. ` +
          `Please apply for ${paid} casual day${paid === 1 ? '' : 's'} and ${excess} LOP day${excess === 1 ? '' : 's'} as separate requests.`,
      );
    }
  } else if (leaveBalance && leaveBalance.remaining < requestedDays) {
    const pendingSameType = sumPendingLeaveDays(
      employeeLeaves,
      payload.type,
      undefined,
      undefined,
    );
    const available = leaveBalance.remaining - pendingSameType;
    if (available < requestedDays) {
      throw new Error(
        `Insufficient ${payload.type} balance. Remaining: ${Math.max(0, available)}, Requested: ${requestedDays}`,
      );
    }
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
  if (lopDays > 0) {
    leave.lopDays = lopDays;
  }
  await col.insertOne(leave);

  if (lopDays > 0) {
    try {
      await notificationService.createNotification({
        recipientId: payload.employeeId,
        recipientType: 'Employee',
        type: 'LeaveLop',
        title: 'LOP days recorded',
        message:
          payload.type === LOP_LEAVE_TYPE
            ? `Your LOP leave request (${payload.from} to ${payload.to}) will add ${lopDays} LOP day${lopDays === 1 ? '' : 's'} once approved.`
            : `Your casual leave request includes ${lopDays} LOP day${lopDays === 1 ? '' : 's'} because it was applied for the same day or exceeds your casual balance.`,
        relatedData: {
          leaveId: id,
          employeeId: payload.employeeId,
          lopDays,
        },
      });
    } catch (error) {
      console.error('Error creating LOP notification:', error);
    }
  }

  // Create notification for manager/admin
  try {
    // Notify all admins
    const userCollection = getDB().collection('users');
    const admins = await userCollection.find({ role: 'Admin' }).toArray();
    for (const admin of admins) {
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
    }
  } catch (error) {
    console.error('Error creating notification for leave submission:', error);
    // Don't throw - notification failure shouldn't break leave creation
  }

  return leave as LeaveRequest;
}

async function loadLeavesForBalance(employeeId: string, refDate = new Date()): Promise<LeaveRequest[]> {
  const active = await getAllLeaves(employeeId);
  const archivedEarned = await getArchivedEarnedLeavesForBalance(employeeId, refDate);
  return [...active, ...archivedEarned];
}

async function getArchivedEarnedLeavesForBalance(employeeId: string, refDate = new Date()): Promise<LeaveRequest[]> {
  const ids = await resolveLeaveEmployeeIds(employeeId);
  const year = String(refDate.getFullYear());
  const archiveCol = getDB().collection('leave_archives');
  const docs = await archiveCol
    .find({
      employeeId: { $in: ids },
      type: 'Earned Leave',
      status: 'Approved',
      from: { $regex: `^${year}` },
    })
    .toArray();
  return docs as LeaveRequest[];
}

export type LeaveBalanceRecord = {
  total: number;
  used: number;
  remaining: number;
  approved?: number;
  pending?: number;
};

export async function getLeaveBalances(
  employeeId: string,
  refDate = new Date(),
): Promise<Record<string, LeaveBalanceRecord>> {
  const leaves = await getAllLeaves(employeeId);
  const archivedEarned = await getArchivedEarnedLeavesForBalance(employeeId, refDate);
  const employee = await findEmployeeDoc(employeeId);
  const canonicalId = employee?.id ? String(employee.id) : employeeId;
  const compCredits = await getCompensationLeaveCreditsForYear(canonicalId, refDate.getFullYear());
  const balanceOptions = leaveBalanceOptions(employee, compCredits, refDate);
  const balances = calculateBalances([...leaves, ...archivedEarned], employee?.joinedAt as string | undefined, balanceOptions);
  const lop = calculateMonthlyLopSummary(
    leaves,
    employee?.joinedAt as string | undefined,
    balanceOptions,
  );

  return {
    ...balances,
    'LOP Days': {
      total: 0,
      used: lop.totalLopDays,
      remaining: 0,
      approved: lop.approvedLopDays,
      pending: lop.pendingLopDays,
    },
  };
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
  /** Current allotted days per type (includes admin overrides). */
  allocations: Record<string, number>;
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

/** Pending always cancellable; approved only while the leave period has not ended. */
export function canCancelLeaveRequest(leave: Pick<LeaveRequest, 'status' | 'to'>): boolean {
  if (leave.status === 'Pending') return true;
  if (leave.status === 'Approved') {
    const end = typeof leave.to === 'string' ? leave.to.slice(0, 10) : '';
    return Boolean(end && end >= getTodayDateString());
  }
  return false;
}

function isApprovedLeaveActiveOnDate(leave: LeaveRequest, dateStr: string): boolean {
  return leave.status === 'Approved' && leave.from <= dateStr && dateStr <= leave.to;
}

export async function getEmployeeLeaveSummary(employeeId: string): Promise<EmployeeLeaveSummary> {
  const leaves = await getAllLeaves(employeeId);
  const archivedEarned = await getArchivedEarnedLeavesForBalance(employeeId);
  const employee = await findEmployeeDoc(employeeId);
  const canonicalId = employee?.id ? String(employee.id) : employeeId;
  const compCredits = await getCompensationLeaveCreditsForYear(canonicalId);
  const balances = calculateBalances([...leaves, ...archivedEarned], employee?.joinedAt as string | undefined, leaveBalanceOptions(employee, compCredits));
  const allocationDisplay: Record<string, number> = {
    'Casual Leave': balances['Casual Leave']?.total ?? LEAVE_ALLOCATIONS['Casual Leave'],
    'Sick Leave': balances['Sick Leave']?.total ?? LEAVE_ALLOCATIONS['Sick Leave'],
    'Earned Leave': balances['Earned Leave']?.total ?? 0,
    'Compensation Leave': balances['Compensation Leave']?.total ?? 0,
  };
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

  const employeeName = employee
    ? [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ').trim() ||
      leaves[0]?.employeeName ||
      'Unknown'
    : leaves[0]?.employeeName ?? 'Unknown';

  return {
    employeeId: canonicalId,
    employeeName,
    allocations: allocationDisplay,
    balances: balanceList,
    currentLeaves,
    history: leaves.filter((l) =>
      ['Approved', 'Rejected', 'Cancelled', 'Pending'].includes(l.status),
    ),
  };
}

const ALLOCATION_TYPES = ['Casual Leave', 'Sick Leave', 'Earned Leave'] as const;

export async function updateEmployeeLeaveAllocations(
  employeeId: string,
  payload: Partial<Record<(typeof ALLOCATION_TYPES)[number], number>>,
): Promise<Record<string, number>> {
  const employee = await findEmployeeDoc(employeeId);
  if (!employee?.id) {
    throw new Error('Employee not found');
  }

  const next: Record<string, number> = { ...(employee.leaveAllocations ?? {}) };
  for (const type of ALLOCATION_TYPES) {
    if (payload[type] === undefined) continue;
    const value = Number(payload[type]);
    if (Number.isNaN(value) || value < 0) {
      throw new Error(`${type} allotment must be a non-negative number`);
    }
    next[type] = value;
  }

  await getDB()
    .collection('employees')
    .updateOne({ id: String(employee.id) }, { $set: { leaveAllocations: next, updatedAt: new Date() } });

  const compCredits = await getCompensationLeaveCreditsForYear(String(employee.id));
  const totals = calculateBalances([], employee.joinedAt as string | undefined, {
    ...leaveBalanceOptions(employee, compCredits),
    employeeAllocations: next,
  });

  return {
    'Casual Leave': totals['Casual Leave'].total,
    'Sick Leave': totals['Sick Leave'].total,
    'Earned Leave': totals['Earned Leave'].total,
    'Compensation Leave': totals['Compensation Leave'].total,
  };
}

export async function updateLeaveStatus(
  id: string,
  status: 'Approved' | 'Rejected',
  rejectionReason?: string,
  actionBy?: string
): Promise<LeaveRequest | null> {
  const col = getLeaveCol();
  const existing = await col.findOne({ id });
  if (!existing) return null;

  if (existing.status !== 'Pending') {
    throw new Error('Only pending leave requests can be approved or rejected');
  }

  if (status === 'Rejected') {
    const reason = rejectionReason?.trim();
    if (!reason) {
      throw new Error('Rejection reason is required');
    }
  }

  const updateDoc: any = {
    status,
    updatedAt: new Date(),
  };

  if (status === 'Approved') {
    const leave = existing as LeaveRequest;
    const employeeLeaves = await loadLeavesForBalance(leave.employeeId);
    const employeeDoc = await getDB().collection('employees').findOne(
      { id: leave.employeeId },
      { projection: { documents: 0, 'photo.data': 0 } },
    );
    const compCredits = await getCompensationLeaveCreditsForYear(leave.employeeId);
    const balanceOptions = {
      ...leaveBalanceOptions(employeeDoc as Employee | null, compCredits),
      employeeAllocations: (employeeDoc as Employee | null)?.leaveAllocations,
    };
    const balances = calculateBalances(
      employeeLeaves,
      (employeeDoc as Employee | null)?.joinedAt as string | undefined,
      balanceOptions,
    );

    if (leave.type === 'Sick Leave') {
      const pendingSick = sumPendingLeaveDays(employeeLeaves, 'Sick Leave', undefined, leave.id);
      const sickBalance = balances['Sick Leave'];
      const availableSick = (sickBalance?.remaining ?? 0) - pendingSick;
      if (availableSick < leave.days) {
        throw new Error(
          `Cannot approve: Insufficient Sick Leave balance. ` +
          `Remaining: ${Math.max(0, availableSick)}, Requested: ${leave.days}`,
        );
      }
    } else if (leave.type === LOP_LEAVE_TYPE) {
      updateDoc.lopDays = leave.days;
    } else if (leave.type === 'Casual Leave') {
      const split = computeCasualLeaveLopForRequest(
        leave.days,
        employeeLeaves,
        (employeeDoc as Employee | null)?.joinedAt as string | undefined,
        balanceOptions,
        leave.id,
        leave.from,
      );
      if (split.lopDays > 0) {
        throw new Error(
          `Cannot approve: only ${split.paidDays} casual day${split.paidDays === 1 ? '' : 's'} available. ` +
            `Employee must submit separate casual and LOP requests.`,
        );
      }
    } else {
      const balanceKey = resolveLeaveBalanceKey(leave.type);
      const leaveBalance = balances[balanceKey];
      const pendingSameType = sumPendingLeaveDays(employeeLeaves, leave.type, undefined, leave.id);
      const available = (leaveBalance?.remaining ?? 0) - pendingSameType;
      if (available < leave.days) {
        throw new Error(
          `Cannot approve: Insufficient ${leave.type} balance. ` +
          `Remaining: ${Math.max(0, available)}, Requested: ${leave.days}`,
        );
      }
    }

    updateDoc.approvalDate = new Date();
    updateDoc.approvedAt = new Date();
    if (actionBy) updateDoc.approvedBy = actionBy;
  }

  if (status === 'Rejected' && rejectionReason) {
    updateDoc.rejectionReason = rejectionReason;
    updateDoc.rejectedAt = new Date();
    if (actionBy) updateDoc.rejectedBy = actionBy;
  }

  const result = await col.findOneAndUpdate(
    { id, status: 'Pending' },
    { $set: updateDoc },
    { returnDocument: 'after' },
  );

  if (!result || result.status !== status) {
    throw new Error('Leave request is no longer pending');
  }

  if (result.status === status) {
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
    }
  }

  return result as LeaveRequest | null;
}

export async function cancelLeave(
  id: string,
  cancelReason?: string,
  cancelledBy?: string,
  options?: { notifyAdmins?: boolean },
): Promise<LeaveRequest | null> {
  const col = getLeaveCol();
  const existing = await col.findOne({ id, status: { $in: ['Approved', 'Pending'] } });
  if (!existing) return null;

  if (!canCancelLeaveRequest(existing as LeaveRequest)) {
    throw new Error('Cannot cancel approved leave that has already ended.');
  }

  const now = new Date();
  const result = await col.findOneAndUpdate(
    { id },
    {
      $set: {
        status: 'Cancelled',
        cancelReason: cancelReason?.trim() || undefined,
        cancelledBy,
        cancelledAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: 'after' },
  );

  if (!result) return null;

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
        leaveType: result.type,
        from: result.from,
        to: result.to,
        days: result.days,
      },
    });
  } catch (error) {
    console.error('Error creating cancellation notification:', error);
  }

  if (options?.notifyAdmins) {
    try {
      const userCollection = getDB().collection('users');
      const admins = await userCollection.find({ role: 'Admin' }).toArray();
      const reasonSuffix = cancelReason?.trim() ? ` Reason: ${cancelReason.trim()}` : '';
      for (const admin of admins) {
        await notificationService.createNotification({
          recipientId: admin.id,
          recipientType: 'Admin',
          type: 'LeaveCancelled',
          title: 'Leave Cancelled by Employee',
          message: `${result.employeeName} cancelled their ${result.type} leave (${result.from} to ${result.to}).${reasonSuffix}`,
          relatedData: {
            leaveId: id,
            employeeId: result.employeeId,
            employeeName: result.employeeName,
          },
        });
      }
    } catch (error) {
      console.error('Error notifying admins about leave cancellation:', error);
    }
  }

  return result as LeaveRequest;
}

/** Admin revokes an approved leave with reason — moves to Rejected and restores balance. */
export async function revokeApprovedLeave(
  id: string,
  rejectionReason: string,
  actionBy?: string,
): Promise<LeaveRequest | null> {
  const col = getLeaveCol();
  const existing = await col.findOne({ id, status: 'Approved' });
  if (!existing) return null;

  if (!canCancelLeaveRequest(existing as LeaveRequest)) {
    throw new Error('Cannot revoke approved leave that has already ended.');
  }

  const reason = rejectionReason?.trim();
  if (!reason) {
    throw new Error('Rejection reason is required');
  }
  if (reason.length > 500) {
    throw new Error('Rejection reason must be under 500 characters');
  }

  const now = new Date();
  const result = await col.findOneAndUpdate(
    { id, status: 'Approved' },
    {
      $set: {
        status: 'Rejected',
        rejectionReason: reason,
        rejectedAt: now,
        rejectedBy: actionBy,
        updatedAt: now,
      },
    },
    { returnDocument: 'after' },
  );

  if (!result) return null;

  try {
    await notificationService.createNotification({
      recipientId: result.employeeId,
      recipientType: 'Employee',
      type: 'LeaveRejected',
      title: 'Approved Leave Revoked',
      message: `Your approved ${result.type} leave (${result.from} to ${result.to}) was revoked. Reason: ${reason}`,
      relatedData: {
        leaveId: id,
        employeeId: result.employeeId,
        employeeName: result.employeeName,
        leaveType: result.type,
        from: result.from,
        to: result.to,
        days: result.days,
      },
    });
  } catch (error) {
    console.error('Error creating revoke notification:', error);
  }

  return result as LeaveRequest;
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

export async function deleteAllLeaves(): Promise<{ deletedCount: number }> {
  const col = getLeaveCol();
  const result = await col.deleteMany({});
  await getDB().collection('notifications').deleteMany({
    type: { $in: ['LeaveSubmitted', 'LeaveApproved', 'LeaveRejected', 'LeaveCancelled'] },
  });
  return { deletedCount: result.deletedCount };
}

const LEAVE_RESET_SETTINGS_KEY = 'leaveMonthlyResetMonth';

function currentLeaveResetMonthKey(refDate = new Date()): string {
  return `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`;
}

async function getLastLeaveMonthlyResetMonth(): Promise<string | null> {
  const doc = await getDB().collection('app_settings').findOne({ key: LEAVE_RESET_SETTINGS_KEY });
  return doc?.value ? String(doc.value) : null;
}

async function setLastLeaveMonthlyResetMonth(monthKey: string): Promise<void> {
  await getDB()
    .collection('app_settings')
    .updateOne(
      { key: LEAVE_RESET_SETTINGS_KEY },
      { $set: { key: LEAVE_RESET_SETTINGS_KEY, value: monthKey, updatedAt: new Date() } },
      { upsert: true },
    );
}

/** True when leave starts before the given yyyy-MM month (May and earlier when cutoff is June). */
function isLeaveBeforeMonth(leave: { from?: string }, cutoffMonthKey: string): boolean {
  const startMonth = leaveMonth(String(leave.from ?? ''));
  if (!startMonth || !cutoffMonthKey) return false;
  return startMonth < cutoffMonthKey;
}

/**
 * Archive and remove leave requests that start before the current month.
 * Example: on 1 June, removes May and earlier; keeps June and future months.
 */
export async function archiveAndDeleteLeavesBeforeMonth(cutoffMonthKey: string): Promise<{
  archivedCount: number;
  deletedCount: number;
}> {
  const col = getLeaveCol();
  const archiveCol = getDB().collection('leave_archives');
  const allLeaves = (await col.find({}).toArray()) as LeaveRequest[];
  const toArchive = allLeaves.filter((l) => isLeaveBeforeMonth(l, cutoffMonthKey));

  if (!toArchive.length) {
    return { archivedCount: 0, deletedCount: 0 };
  }

  const archivedAt = new Date();
  const archiveMonth = cutoffMonthKey;
  const docs = toArchive.map((doc) => {
    const { _id, ...rest } = doc as LeaveRequest & { _id?: unknown };
    return { ...rest, archiveMonth, archivedAt };
  });
  await archiveCol.insertMany(docs);

  const ids = toArchive.map((l) => l.id).filter(Boolean);
  const deleteResult = await col.deleteMany({ id: { $in: ids } });

  if (ids.length) {
    await getDB().collection('notifications').deleteMany({
      type: { $in: ['LeaveSubmitted', 'LeaveApproved', 'LeaveRejected', 'LeaveCancelled'] },
      'relatedData.leaveId': { $in: ids },
    });
  }

  return { archivedCount: docs.length, deletedCount: deleteResult.deletedCount };
}

/** Archives then clears leave requests for prior months only (keeps current + future). */
export async function runMonthlyLeaveHistoryReset(): Promise<{
  deletedCount: number;
  archivedCount: number;
  monthKey: string;
}> {
  const monthKey = currentLeaveResetMonthKey();
  const { archivedCount, deletedCount } = await archiveAndDeleteLeavesBeforeMonth(monthKey);
  await setLastLeaveMonthlyResetMonth(monthKey);
  return { deletedCount, archivedCount, monthKey };
}

/** Runs on the 1st (or first server start in a new month if the 1st was missed). */
export async function ensureMonthlyLeaveHistoryReset(): Promise<{ ran: boolean; deletedCount?: number }> {
  const monthKey = currentLeaveResetMonthKey();
  const last = await getLastLeaveMonthlyResetMonth();

  if (last === monthKey) {
    return { ran: false };
  }

  // First run: anchor current month without deleting existing history.
  if (last === null) {
    await setLastLeaveMonthlyResetMonth(monthKey);
    return { ran: false };
  }

  const { deletedCount, archivedCount } = await runMonthlyLeaveHistoryReset();
  console.log(
    `[LeaveReset] Monthly reset for ${monthKey}: archived ${archivedCount}, removed ${deletedCount} leave(s) from prior months (current/future kept)`,
  );
  return { ran: true, deletedCount };
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

export async function updateHoliday(id: string, payload: { title?: string; date?: string; description?: string; type?: HolidayType; skipped?: boolean; skippedReason?: string }): Promise<Holiday | null> {
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
import { validateLeaveDates } from '../utils/dateValidation';

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
    const employee = await employeeCollection.findOne(
      { employeeId: leave.employeeId },
      { projection: { documents: 0, 'photo.data': 0 } }
    );
    
    if (!employee || !employee.email) {
      console.warn(`[Leave Email] No email found for employee ${leave.employeeId}`);
      return;
    }
    
    await emailService.sendLeaveStatusEmail({
      recipientEmail: (employee as any).email,
      recipientName: `${(employee as any).firstName} ${(employee as any).lastName}`,
      employeeName: leave.employeeName,
      type: leave.type,
      from: leave.from,
      to: leave.to,
      days: leave.days,
      status: leave.status,
      rejectionReason: leave.rejectionReason,
    }, `${env.FRONTEND_URL}/employee/leaves`);
    
  } catch (error) {
    console.error('[Leave Email] Error sending employee notification:', error);
  }
}

export async function purgeCancelledLeavesFromDatabase(): Promise<number> {
  const col = getLeaveCol();
  const result = await col.deleteMany({ status: 'Cancelled' });
  return result.deletedCount;
}

