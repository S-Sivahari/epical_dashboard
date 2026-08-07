import { Collection } from 'mongodb';
import { getDB } from '../config/db';
import {
  findEmployeeByLoginEmail,
  findUserForEmployee,
  getEmployeeLoginEmails,
  getEmployeeOfficialEmail,
  resolveEmployeeForAuthUser,
} from '../utils/employeeAuth';
import { LeaveRequest, CreateLeavePayload } from '../models/Leave';
import { Holiday } from '../models/Holiday';
import {
  getBusinessDays,
  calculateBalances,
  calculateMonthlyLopSummary,
  calculateYearlyLopSummary,
  computeCasualLeaveLopForRequest,
  computeSickLeaveLopForRequest,
  LOP_LEAVE_TYPE,
  leaveMonth,
  LEAVE_ALLOCATIONS,
  resolveLeaveBalanceKey,
  sumPendingLeaveDays,
  assertLeaveBalanceStep,
  withPendingLeaveReservations,
  monthsWorkedInCurrentYear,
  calculateEarnedLeaveAllocation,
  EARNED_LEAVE_ACCRUAL_PER_MONTH,
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
  const userCol = getDB().collection('users');
  const NO_BLOBS_PROJECTION = { projection: { documents: 0, 'photo.data': 0 } };

  const [emp, user] = await Promise.all([
    employeeCol.findOne(
      {
        $or: [
          { id: trimmed },
          { employeeId: trimmed },
          { employeeId: trimmed.toUpperCase() },
        ],
      },
      NO_BLOBS_PROJECTION,
    ),
    userCol.findOne({
      $or: [{ id: trimmed }, { email: trimmed.toLowerCase() }],
    }),
  ]);

  if (emp?.id) ids.add(String(emp.id));
  if (emp?.employeeId) {
    ids.add(String(emp.employeeId));
    ids.add(String(emp.employeeId).toUpperCase());
  }

  const emailLookups: Promise<void>[] = [];
  if (emp) {
    emailLookups.push(
      (async () => {
        const linkedUser = await findUserForEmployee(emp as any);
        if (linkedUser?.id) ids.add(String(linkedUser.id));
      })(),
    );
    const emails = getEmployeeLoginEmails(emp as { email?: string; personalEmail?: string });
    if (emails.length > 0) {
      emailLookups.push(
        (async () => {
          const byEmails = await userCol
            .find({ email: { $in: emails } })
            .project({ id: 1 })
            .toArray();
          for (const row of byEmails) {
            if (row?.id) ids.add(String(row.id));
          }
        })(),
      );
    }
  }

  if (user?.id) ids.add(String(user.id));
  if (user?.email) {
    emailLookups.push(
      (async () => {
        const empByEmail = await findEmployeeByLoginEmail(String(user.email));
        if (empByEmail?.id) ids.add(String(empByEmail.id));
        if (empByEmail?.employeeId) {
          ids.add(String(empByEmail.employeeId));
          ids.add(String(empByEmail.employeeId).toUpperCase());
        }
      })(),
    );
  }

  if (emailLookups.length > 0) await Promise.all(emailLookups);

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

function employeeBalanceUsedAdjustments(
  employee: Employee | null | undefined,
  refDate = new Date(),
): Partial<Record<string, number>> {
  const year = String(refDate.getFullYear());
  return employee?.leaveBalanceAdjustments?.[year] ?? {};
}

/**
 * Resolve the current Earned Leave total, persisting a checkpoint so it is only
 * recomputed when a new employed calendar month actually completes.
 *
 * Earlier the total was fully re-derived from joinedAt on every read UNLESS an admin
 * had ever manually set it, in which case it froze at that value forever (the override
 * and the live calc shared one field with no way to tell them apart). Now the accrual
 * state (`monthsAccrued` + running `total`) is stored on the employee: a manual edit
 * rebases both to "caught up as of now" rather than freezing them, so the next
 * completed month still adds its 0.5 on top.
 */
async function resolveEarnedLeaveTotal(
  employee: Employee | null | undefined,
  refDate: Date,
): Promise<number> {
  if (!employee?.id) return 0;

  const joinedAt = employee.joinedAt as string | undefined;
  const monthEndAccrual = employee.earnedLeaveMonthEndAccrual !== false;
  const currentYear = refDate.getFullYear();

  // Historical/future report views (e.g. viewing a past year's balances) must never
  // mutate the live checkpoint — derive read-only, same as the pre-checkpoint behavior.
  if (currentYear !== new Date().getFullYear()) {
    const legacyOverride = employee.leaveAllocations?.['Earned Leave'];
    return legacyOverride !== undefined && legacyOverride !== null && !Number.isNaN(Number(legacyOverride))
      ? Math.max(0, Number(legacyOverride))
      : calculateEarnedLeaveAllocation(joinedAt, refDate, monthEndAccrual);
  }

  const monthsNow = monthsWorkedInCurrentYear(joinedAt, refDate, monthEndAccrual);
  const state = employee.earnedLeaveAccrual;

  if (state && state.year === currentYear) {
    if (monthsNow <= state.monthsAccrued) return state.total;
    const total = state.total + (monthsNow - state.monthsAccrued) * EARNED_LEAVE_ACCRUAL_PER_MONTH;
    const nextState = { year: currentYear, monthsAccrued: monthsNow, total };
    await getDB()
      .collection('employees')
      .updateOne({ id: String(employee.id) }, { $set: { earnedLeaveAccrual: nextState, updatedAt: new Date() } });
    employee.earnedLeaveAccrual = nextState;
    return total;
  }

  // No checkpoint for this year yet. If the employee was never migrated (no state at
  // all), preserve whatever legacy manual total an admin last set as the new baseline
  // instead of silently discarding it. A genuine year rollover (state.year < currentYear)
  // always restarts the yearly accrual from zero — Earned Leave resets each year.
  const legacyOverride = !state ? employee.leaveAllocations?.['Earned Leave'] : undefined;
  const total =
    legacyOverride !== undefined && legacyOverride !== null && !Number.isNaN(Number(legacyOverride))
      ? Math.max(0, Number(legacyOverride))
      : monthsNow * EARNED_LEAVE_ACCRUAL_PER_MONTH;

  const nextState = { year: currentYear, monthsAccrued: monthsNow, total };
  await getDB()
    .collection('employees')
    .updateOne({ id: String(employee.id) }, { $set: { earnedLeaveAccrual: nextState, updatedAt: new Date() } });
  employee.earnedLeaveAccrual = nextState;
  return total;
}

async function leaveBalanceOptions(
  employee: Employee | null | undefined,
  compensationLeaveCredits: number,
  refDate = new Date(),
) {
  const earnedLeaveTotal = await resolveEarnedLeaveTotal(employee, refDate);
  return {
    compensationLeaveCredits,
    employeeAllocations: {
      ...employeeAllocationOverrides(employee),
      'Earned Leave': earnedLeaveTotal,
    },
    balanceUsedAdjustments: employeeBalanceUsedAdjustments(employee, refDate),
    refDate,
    earnedLeaveMonthEndAccrual: employee?.earnedLeaveMonthEndAccrual !== false,
  };
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
  const balanceOptions = await leaveBalanceOptions(employeeDoc, compCredits);
  const balances = calculateBalances(employeeLeaves, employeeDoc?.joinedAt as string | undefined, balanceOptions);

  const balanceKey = resolveLeaveBalanceKey(payload.type);
  const leaveBalance = balances[balanceKey];
  let lopDays = 0;
  let paidDebitDays = requestedDays;

  if (payload.type === LOP_LEAVE_TYPE) {
    lopDays = requestedDays;
    paidDebitDays = 0;
  } else if (payload.type === 'Sick Leave') {
    const split = computeSickLeaveLopForRequest(
      requestedDays,
      employeeLeaves,
      employeeDoc?.joinedAt as string | undefined,
      balanceOptions,
    );
    lopDays = split.lopDays;
    paidDebitDays = Math.max(0, requestedDays - lopDays);
  } else if (payload.type === 'Casual Leave') {
    const split = computeCasualLeaveLopForRequest(
      requestedDays,
      employeeLeaves,
      employeeDoc?.joinedAt as string | undefined,
      balanceOptions,
      undefined,
      payload.from,
      new Date(),
    );
    lopDays = split.lopDays;
    paidDebitDays = Math.max(0, requestedDays - lopDays);
  }

  if (payload.type !== LOP_LEAVE_TYPE && paidDebitDays > 0 && leaveBalance) {
    const reserved = withPendingLeaveReservations(balances, employeeLeaves);
    const available = reserved[balanceKey]?.remaining ?? leaveBalance.remaining;
    if (available < paidDebitDays) {
      throw new Error(
        `Insufficient ${payload.type} balance. Remaining: ${Math.max(0, available)}, Requested: ${paidDebitDays}`,
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

  // Notify admins only — employees are notified when leave is approved/rejected/cancelled.
  try {
    await notificationService.notifyAllAdmins({
      type: 'LeaveSubmitted',
      title: 'New Leave Request',
      message: `${payload.employeeName} has submitted a ${payload.type} leave request from ${payload.from} to ${payload.to}`,
      relatedData: {
        leaveId: id,
        employeeId: payload.employeeId,
        employeeName: payload.employeeName,
      },
    });
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
  preloadedLeaves?: Awaited<ReturnType<typeof getAllLeaves>>,
): Promise<Record<string, LeaveBalanceRecord>> {
  const leaves = preloadedLeaves ?? (await getAllLeaves(employeeId));
  const archivedEarned = await getArchivedEarnedLeavesForBalance(employeeId, refDate);
  const employee = await findEmployeeDoc(employeeId);
  const canonicalId = employee?.id ? String(employee.id) : employeeId;
  const compCredits = await getCompensationLeaveCreditsForYear(canonicalId, refDate.getFullYear());
  const balanceOptions = await leaveBalanceOptions(employee, compCredits, refDate);
  const approvedBalances = calculateBalances(
    [...leaves, ...archivedEarned],
    employee?.joinedAt as string | undefined,
    balanceOptions,
  );
  const balances = withPendingLeaveReservations(approvedBalances, leaves, refDate);
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
  usedThisMonth?: number;
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

/** True when the leave period has fully ended (end date before today). */
export function isLeaveEnded(leave: Pick<LeaveRequest, 'to'>): boolean {
  const end = typeof leave.to === 'string' ? leave.to.slice(0, 10) : '';
  return Boolean(end && end < getTodayDateString());
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
  const balances = calculateBalances([...leaves, ...archivedEarned], employee?.joinedAt as string | undefined, await leaveBalanceOptions(employee, compCredits));
  const reservedBalances = withPendingLeaveReservations(balances, leaves);
  const allocationDisplay: Record<string, number> = {
    'Casual Leave': reservedBalances['Casual Leave']?.total ?? LEAVE_ALLOCATIONS['Casual Leave'],
    'Sick Leave': reservedBalances['Sick Leave']?.total ?? LEAVE_ALLOCATIONS['Sick Leave'],
    'Earned Leave': reservedBalances['Earned Leave']?.total ?? 0,
    'Compensation Leave': reservedBalances['Compensation Leave']?.total ?? 0,
  };
  const todayStr = getTodayDateString();

  const balanceList: LeaveTypeBalanceSummary[] = Object.entries(reservedBalances).map(([type, b]) => ({
    type,
    total: b.total,
    used: b.used,
    pending: b.pending,
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

  const displayEmployeeId = employee?.employeeId
    ? String(employee.employeeId)
    : employeeId;

  return {
    employeeId: employee?.employeeId ? String(employee.employeeId) : canonicalId,
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

  const refDate = new Date();
  const next: Record<string, number> = { ...(employee.leaveAllocations ?? {}) };
  let earnedLeaveAccrualUpdate: { year: number; monthsAccrued: number; total: number } | undefined;

  for (const type of ALLOCATION_TYPES) {
    if (payload[type] === undefined) continue;
    const value = Number(payload[type]);
    if (Number.isNaN(value) || value < 0) {
      throw new Error(`${type} allotment must be a non-negative number`);
    }
    assertLeaveBalanceStep(type, value, 'total');

    if (type === 'Earned Leave') {
      // Rebase the persisted accrual checkpoint to "caught up as of now" rather than
      // writing into leaveAllocations, which would otherwise permanently freeze future
      // monthly accrual for this employee (see resolveEarnedLeaveTotal).
      const monthsNow = monthsWorkedInCurrentYear(
        employee.joinedAt as string | undefined,
        refDate,
        employee.earnedLeaveMonthEndAccrual !== false,
      );
      earnedLeaveAccrualUpdate = { year: refDate.getFullYear(), monthsAccrued: monthsNow, total: value };
    } else {
      next[type] = value;
    }
  }

  const setDoc: Record<string, unknown> = { leaveAllocations: next, updatedAt: new Date() };
  if (earnedLeaveAccrualUpdate) {
    setDoc.earnedLeaveAccrual = earnedLeaveAccrualUpdate;
  }
  await getDB()
    .collection('employees')
    .updateOne({ id: String(employee.id) }, { $set: setDoc });

  employee.leaveAllocations = next as Employee['leaveAllocations'];
  if (earnedLeaveAccrualUpdate) {
    employee.earnedLeaveAccrual = earnedLeaveAccrualUpdate;
  }

  const compCredits = await getCompensationLeaveCreditsForYear(String(employee.id));
  const totals = calculateBalances(
    [],
    employee.joinedAt as string | undefined,
    await leaveBalanceOptions(employee, compCredits),
  );

  return {
    'Casual Leave': totals['Casual Leave'].total,
    'Sick Leave': totals['Sick Leave'].total,
    'Earned Leave': totals['Earned Leave'].total,
    'Compensation Leave': totals['Compensation Leave'].total,
  };
}

const BALANCE_ADJUSTMENT_TYPES = [
  'Casual Leave',
  'Sick Leave',
  'Earned Leave',
  'Compensation Leave',
] as const;

type BalanceAdjustmentType = (typeof BALANCE_ADJUSTMENT_TYPES)[number];

const POST_ARCHIVE_REPAIR_TYPES = ['Casual Leave', 'Sick Leave'] as const;
type PostArchiveRepairType = (typeof POST_ARCHIVE_REPAIR_TYPES)[number];

export type LeaveBalanceRepairChange = {
  employeeId: string;
  employeeName: string;
  type: PostArchiveRepairType;
  before: { total: number; used: number; remaining: number };
  after: { total: number; used: number; remaining: number };
  allocationSetTo: number;
  usedAdjustmentSetTo: number;
};

export type LeaveBalanceRepairResult = {
  year: number;
  dryRun: boolean;
  scanned: number;
  changed: number;
  changes: LeaveBalanceRepairChange[];
};

/**
 * Restore Casual/Sick year used after past leave rows were deleted but remaining stayed low.
 * Keeps remaining fixed; sets allotment to default; sets used = default − remaining via adjustments.
 * Does not modify leave request history or usedThisMonth (payslip month usage).
 */
export async function repairPostArchiveLeaveBalances(options?: {
  dryRun?: boolean;
  year?: number;
}): Promise<LeaveBalanceRepairResult> {
  const dryRun = options?.dryRun !== false;
  const year = options?.year ?? new Date().getFullYear();
  const yearStr = String(year);
  const refDate = resolveRefDateForCalendarYear(year);
  const employees = await getActiveEmployeesForBalanceReport();
  const changes: LeaveBalanceRepairChange[] = [];

  for (const employee of employees) {
    if (!employee.id) continue;
    const internalId = String(employee.id);
    try {
    const employeeName = employeeDisplayName(employee);
    const leaves = await getAllLeaves(internalId);
    const archivedEarned = await getArchivedEarnedLeavesForBalance(internalId, refDate);
    const compCredits = await getCompensationLeaveCreditsForYear(internalId, year);

    const resolvedOptions = await leaveBalanceOptions(employee, compCredits, refDate);
    const currentBalances = calculateBalances(
      [...leaves, ...archivedEarned],
      employee.joinedAt as string | undefined,
      resolvedOptions,
    );

    const rawBalances = calculateBalances(
      [...leaves, ...archivedEarned],
      employee.joinedAt as string | undefined,
      {
        ...resolvedOptions,
        balanceUsedAdjustments: {},
      },
    );

    const nextAllocations: Record<string, number> = { ...(employee.leaveAllocations ?? {}) };
    const adjustmentsByYear: Record<string, Record<string, number>> = {
      ...(employee.leaveBalanceAdjustments ?? {}),
    };
    const yearAdjustments: Record<string, number> = { ...(adjustmentsByYear[yearStr] ?? {}) };
    let employeeChanged = false;

    for (const type of POST_ARCHIVE_REPAIR_TYPES) {
      const defaultTotal = LEAVE_ALLOCATIONS[type];
      const before = currentBalances[type] ?? { total: 0, used: 0, remaining: 0 };
      const remaining = Math.max(0, Number(before.remaining) || 0);
      const desiredUsed = Math.max(0, defaultTotal - remaining);
      const rawUsed = Math.max(0, Number(rawBalances[type]?.used) || 0);
      const desiredAdjustment = desiredUsed - rawUsed;

      const alreadyOk =
        Math.abs(Number(before.total) - defaultTotal) < 1e-9 &&
        Math.abs(Number(before.used) - desiredUsed) < 1e-9 &&
        Math.abs(Number(before.remaining) - remaining) < 1e-9;

      if (alreadyOk) continue;
      // Only repair when remaining is below default (shrunk allotment / lost used history).
      if (remaining >= defaultTotal && Math.abs(Number(before.total) - defaultTotal) < 1e-9) {
        continue;
      }

      nextAllocations[type] = defaultTotal;
      if (Math.abs(desiredAdjustment) < 1e-9) {
        delete yearAdjustments[type];
      } else {
        yearAdjustments[type] = desiredAdjustment;
      }
      employeeChanged = true;

      changes.push({
        employeeId: employee.employeeId ? String(employee.employeeId) : internalId,
        employeeName,
        type,
        before: {
          total: Number(before.total) || 0,
          used: Number(before.used) || 0,
          remaining,
        },
        after: {
          total: defaultTotal,
          used: desiredUsed,
          remaining,
        },
        allocationSetTo: defaultTotal,
        usedAdjustmentSetTo: desiredAdjustment,
      });
    }

    if (!employeeChanged || dryRun) continue;

    if (Object.keys(yearAdjustments).length === 0) {
      delete adjustmentsByYear[yearStr];
    } else {
      adjustmentsByYear[yearStr] = yearAdjustments;
    }

    const update: Record<string, unknown> = {
      leaveAllocations: nextAllocations,
      updatedAt: new Date(),
    };
    const unset: Record<string, ''> = {};
    if (Object.keys(adjustmentsByYear).length === 0) {
      unset.leaveBalanceAdjustments = '';
    } else {
      update.leaveBalanceAdjustments = adjustmentsByYear;
    }

    const payload =
      Object.keys(unset).length > 0
        ? { $set: update, $unset: unset }
        : { $set: update };

    await getDB().collection('employees').updateOne({ id: internalId }, payload);
    employee.leaveAllocations = nextAllocations as Employee['leaveAllocations'];
    employee.leaveBalanceAdjustments =
      Object.keys(adjustmentsByYear).length === 0
        ? undefined
        : adjustmentsByYear;
    } catch (error) {
      console.error(
        `[leave] repair skipped for employee ${internalId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {
    year,
    dryRun,
    scanned: employees.length,
    changed: changes.length,
    changes,
  };
}

export async function adjustEmployeeLeaveBalance(
  employeeId: string,
  type: BalanceAdjustmentType,
  delta: number,
  refDate = new Date(),
): Promise<EmployeeLeaveSummary> {
  if (!BALANCE_ADJUSTMENT_TYPES.includes(type)) {
    throw new Error('Invalid leave type for balance adjustment');
  }

  const step = Number(delta);
  if (Number.isNaN(step) || step === 0) {
    throw new Error('Adjustment delta must be a non-zero number');
  }
  assertLeaveBalanceStep(type, step, 'adjustment');

  const employee = await findEmployeeDoc(employeeId);
  if (!employee?.id) {
    throw new Error('Employee not found');
  }

  const year = String(refDate.getFullYear());
  const adjustmentsByYear: Record<string, Record<string, number>> = {
    ...(employee.leaveBalanceAdjustments ?? {}),
  };
  const yearAdjustments: Record<string, number> = { ...(adjustmentsByYear[year] ?? {}) };
  const currentAdjustment = Number(yearAdjustments[type] ?? 0) || 0;
  const nextAdjustment = currentAdjustment + step;

  const compCredits = await getCompensationLeaveCreditsForYear(String(employee.id), refDate.getFullYear());
  const leaves = await getAllLeaves(employeeId);
  const archivedEarned = await getArchivedEarnedLeavesForBalance(employeeId, refDate);
  const provisionalAdjustments = { ...yearAdjustments, [type]: nextAdjustment };
  const balances = calculateBalances(
    [...leaves, ...archivedEarned],
    employee.joinedAt as string | undefined,
    {
      ...(await leaveBalanceOptions(employee, compCredits, refDate)),
      balanceUsedAdjustments: provisionalAdjustments,
    },
  );

  const bucket = balances[type];
  if (!bucket) {
    throw new Error('Could not resolve leave balance for adjustment');
  }
  if (bucket.used < 0) {
    throw new Error('Used days cannot be negative');
  }
  if (bucket.remaining < 0) {
    throw new Error('Remaining balance cannot be negative');
  }

  if (nextAdjustment === 0) {
    delete yearAdjustments[type];
  } else {
    yearAdjustments[type] = nextAdjustment;
  }

  if (Object.keys(yearAdjustments).length === 0) {
    delete adjustmentsByYear[year];
  } else {
    adjustmentsByYear[year] = yearAdjustments;
  }

  const updatePayload =
    Object.keys(adjustmentsByYear).length === 0
      ? { $unset: { leaveBalanceAdjustments: '' }, $set: { updatedAt: new Date() } }
      : { $set: { leaveBalanceAdjustments: adjustmentsByYear, updatedAt: new Date() } };

  await getDB()
    .collection('employees')
    .updateOne({ id: String(employee.id) }, updatePayload);

  return getEmployeeLeaveSummary(employeeId);
}

export async function adjustEmployeeLeaveBalances(
  employeeId: string,
  adjustments: Partial<Record<BalanceAdjustmentType, number>>,
  refDate = new Date(),
): Promise<EmployeeLeaveSummary> {
  const entries = (
    Object.entries(adjustments) as [BalanceAdjustmentType, number | undefined][]
  ).filter(([, delta]) => delta !== undefined && delta !== null && Number(delta) !== 0) as [
    BalanceAdjustmentType,
    number,
  ][];

  if (entries.length === 0) {
    throw new Error('At least one balance adjustment is required');
  }

  for (const [type, delta] of entries) {
    const step = Number(delta);
    if (Number.isNaN(step)) {
      throw new Error('Adjustment delta must be a number');
    }
    assertLeaveBalanceStep(type, step, 'adjustment');
  }

  const employee = await findEmployeeDoc(employeeId);
  if (!employee?.id) {
    throw new Error('Employee not found');
  }

  const year = String(refDate.getFullYear());
  const adjustmentsByYear: Record<string, Record<string, number>> = {
    ...(employee.leaveBalanceAdjustments ?? {}),
  };
  const yearAdjustments: Record<string, number> = { ...(adjustmentsByYear[year] ?? {}) };

  const provisionalAdjustments: Record<string, number> = { ...yearAdjustments };
  for (const [type, delta] of entries) {
    const current = Number(provisionalAdjustments[type] ?? 0) || 0;
    const next = current + Number(delta);
    if (next === 0) {
      delete provisionalAdjustments[type];
    } else {
      provisionalAdjustments[type] = next;
    }
  }

  const compCredits = await getCompensationLeaveCreditsForYear(String(employee.id), refDate.getFullYear());
  const leaves = await getAllLeaves(employeeId);
  const archivedEarned = await getArchivedEarnedLeavesForBalance(employeeId, refDate);
  const balances = calculateBalances(
    [...leaves, ...archivedEarned],
    employee.joinedAt as string | undefined,
    {
      ...(await leaveBalanceOptions(employee, compCredits, refDate)),
      balanceUsedAdjustments: provisionalAdjustments,
    },
  );

  for (const type of BALANCE_ADJUSTMENT_TYPES) {
    const bucket = balances[type];
    if (!bucket) continue;
    if (bucket.used < 0) {
      throw new Error('Used days cannot be negative');
    }
    if (bucket.remaining < 0) {
      throw new Error('Remaining balance cannot be negative');
    }
    if (bucket.remaining > bucket.total) {
      throw new Error('Remaining balance cannot exceed the total allotment');
    }
  }

  for (const [type, delta] of entries) {
    const current = Number(yearAdjustments[type] ?? 0) || 0;
    const next = current + Number(delta);
    if (next === 0) {
      delete yearAdjustments[type];
    } else {
      yearAdjustments[type] = next;
    }
  }

  if (Object.keys(yearAdjustments).length === 0) {
    delete adjustmentsByYear[year];
  } else {
    adjustmentsByYear[year] = yearAdjustments;
  }

  const updatePayload =
    Object.keys(adjustmentsByYear).length === 0
      ? { $unset: { leaveBalanceAdjustments: '' }, $set: { updatedAt: new Date() } }
      : { $set: { leaveBalanceAdjustments: adjustmentsByYear, updatedAt: new Date() } };

  await getDB()
    .collection('employees')
    .updateOne({ id: String(employee.id) }, updatePayload);

  return getEmployeeLeaveSummary(employeeId);
}

const YEAR_BALANCE_TYPES = [
  'Casual Leave',
  'Sick Leave',
  'Earned Leave',
  'Compensation Leave',
] as const;

type YearBalanceType = (typeof YEAR_BALANCE_TYPES)[number];

export interface YearLeaveBalanceRow {
  internalId: string;
  employeeId: string;
  employeeName: string;
  department?: string;
  balances: LeaveTypeBalanceSummary[];
  lopDays: number;
  lopThisMonth?: number;
  lopApproved?: number;
  lopPending?: number;
}

export interface YearLeaveBalanceUpdate {
  type: YearBalanceType;
  total?: number;
  used?: number;
}

export interface LeaveAllocationActivity {
  id: string;
  employeeInternalId: string;
  employeeId: string;
  employeeName: string;
  leaveType: YearBalanceType;
  previousTotal: number;
  newTotal: number;
  year: number;
  adjustedBy: string;
  createdAt: string;
}

function leaveAllocationActivityCol(): Collection<any> {
  return getDB().collection('leave_allocation_activities');
}

async function recordLeaveAllocationActivities(
  entries: Omit<LeaveAllocationActivity, 'id' | 'createdAt'>[],
): Promise<void> {
  if (entries.length === 0) return;
  const now = new Date().toISOString();
  await leaveAllocationActivityCol().insertMany(
    entries.map((entry, index) => ({
      ...entry,
      id: `LAA-${Date.now()}-${index}`,
      createdAt: now,
    })),
  );
}

export async function getLeaveAllocationActivities(
  from?: string,
  to?: string,
): Promise<LeaveAllocationActivity[]> {
  const filter: Record<string, unknown> = {};
  if (from || to) {
    const createdAt: Record<string, string> = {};
    if (from) createdAt.$gte = `${from}T00:00:00.000Z`;
    if (to) createdAt.$lte = `${to}T23:59:59.999Z`;
    filter.createdAt = createdAt;
  }

  const docs = await leaveAllocationActivityCol()
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();

  return docs.map((doc) => ({
    id: String(doc.id),
    employeeInternalId: String(doc.employeeInternalId),
    employeeId: String(doc.employeeId),
    employeeName: String(doc.employeeName ?? ''),
    leaveType: doc.leaveType as YearBalanceType,
    previousTotal: Number(doc.previousTotal ?? 0),
    newTotal: Number(doc.newTotal ?? 0),
    year: Number(doc.year ?? new Date().getFullYear()),
    adjustedBy: String(doc.adjustedBy ?? 'Admin'),
    createdAt: String(doc.createdAt ?? new Date().toISOString()),
  }));
}

function resolveRefDateForCalendarYear(year: number): Date {
  const now = new Date();
  if (year === now.getFullYear()) return now;
  if (year > now.getFullYear()) return new Date(year, 0, 1, 12, 0, 0);
  return new Date(year, 11, 31, 12, 0, 0);
}

function employeeDisplayName(employee: Employee): string {
  return (
    [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ').trim() ||
    'Unknown'
  );
}

function leaveFromYearKey(leave: LeaveRequest): string | null {
  if (typeof leave.from !== 'string' || leave.from.length < 4) return null;
  return leave.from.slice(0, 4);
}

function leaveFromMonthKey(leave: LeaveRequest): string | null {
  if (typeof leave.from !== 'string' || leave.from.length < 7) return null;
  return leave.from.slice(0, 7);
}

function buildEmployeeTokenIndex(
  employees: Employee[],
  users: Array<{ id?: string; email?: string }>,
): Map<string, string> {
  const emailToUserId = new Map<string, string>();
  for (const user of users) {
    const email = user.email ? String(user.email).toLowerCase() : '';
    if (email && user.id) {
      emailToUserId.set(email, String(user.id));
    }
  }

  const tokenToInternal = new Map<string, string>();
  for (const employee of employees) {
    const internalId = String(employee.id ?? '');
    if (!internalId) continue;

    const register = (token?: string | null) => {
      if (!token) return;
      const normalized = String(token).trim();
      if (normalized) tokenToInternal.set(normalized, internalId);
    };

    register(internalId);
    register(employee.employeeId);
    if (employee.employeeId) {
      register(String(employee.employeeId).toUpperCase());
    }

    for (const email of getEmployeeLoginEmails(employee as { email?: string; personalEmail?: string })) {
      register(email);
      register(emailToUserId.get(email.toLowerCase()));
    }
  }

  return tokenToInternal;
}

function groupRecordsByInternalEmployeeId<T extends { employeeId?: string }>(
  records: T[],
  tokenToInternal: Map<string, string>,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const record of records) {
    const token = String(record.employeeId ?? '').trim();
    if (!token) continue;
    const internalId = tokenToInternal.get(token);
    if (!internalId) continue;
    const list = grouped.get(internalId) ?? [];
    list.push(record);
    grouped.set(internalId, list);
  }
  return grouped;
}

function sumCompensationCreditsForTokens(
  entries: Array<{ employeeId?: string; days?: number; appliedDate?: string }>,
  tokens: Iterable<string>,
  calendarYear: number,
): number {
  const tokenSet = new Set(Array.from(tokens, (token) => String(token)));
  const yearPrefix = String(calendarYear);
  let sum = 0;

  for (const entry of entries) {
    const entryEmployeeId = String(entry.employeeId ?? '');
    if (!tokenSet.has(entryEmployeeId)) continue;
    if (String(entry.appliedDate || '').slice(0, 4) !== yearPrefix) continue;
    const days = Number(entry.days);
    if (!Number.isNaN(days)) sum += days;
  }

  return sum;
}

async function computeEmployeeYearBalancesFromData(
  employee: Employee,
  year: number,
  leaves: LeaveRequest[],
  archivedEarned: LeaveRequest[],
  compCredits: number,
): Promise<LeaveTypeBalanceSummary[]> {
  const refDate = resolveRefDateForCalendarYear(year);
  const yearStr = String(year);
  const adjustments = employee.leaveBalanceAdjustments?.[yearStr] ?? {};

  const balances = calculateBalances(
    [...leaves, ...archivedEarned],
    employee.joinedAt as string | undefined,
    {
      ...(await leaveBalanceOptions(employee, compCredits, refDate)),
      balanceUsedAdjustments: adjustments,
    },
  );

  const pendingByType: Record<string, number> = {};
  const usedThisMonthByType: Record<string, number> = {};
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  leaves.forEach((leave) => {
    if (leave.status === 'Pending' && leaveFromYearKey(leave) === yearStr) {
      pendingByType[leave.type] = (pendingByType[leave.type] || 0) + leave.days;
    }
    if (leave.status === 'Approved' && leaveFromMonthKey(leave) === currentMonthStr) {
      const lopDays = Number((leave as { lopDays?: number }).lopDays ?? 0) || 0;
      const paidDays = Math.max(0, (Number(leave.days) || 0) - lopDays);
      usedThisMonthByType[leave.type] = (usedThisMonthByType[leave.type] || 0) + paidDays;
    }
  });

  return YEAR_BALANCE_TYPES.map((type) => {
    const bucket = balances[type] ?? { total: 0, used: 0, remaining: 0 };
    return {
      type,
      total: bucket.total,
      used: bucket.used,
      pending: pendingByType[type] || 0,
      remaining: bucket.remaining,
      usedThisMonth: usedThisMonthByType[type] || 0,
    };
  });
}

async function computeEmployeeLopForBalanceViewFromData(
  employee: Employee,
  calendarYear: number,
  leaves: LeaveRequest[],
  compCreditsYear: number,
  compCreditsMonth: number,
  monthRefDate = new Date(),
): Promise<{ lopDays: number; lopThisMonth: number; lopApproved: number; lopPending: number }> {
  const yearRefDate = resolveRefDateForCalendarYear(calendarYear);

  const yearly = calculateYearlyLopSummary(
    leaves,
    calendarYear,
    employee.joinedAt as string | undefined,
    await leaveBalanceOptions(employee, compCreditsYear, yearRefDate),
  );
  const monthly = calculateMonthlyLopSummary(
    leaves,
    employee.joinedAt as string | undefined,
    await leaveBalanceOptions(employee, compCreditsMonth, monthRefDate),
  );

  return {
    lopDays: yearly.totalLopDays,
    lopThisMonth: monthly.totalLopDays,
    lopApproved: yearly.approvedLopDays,
    lopPending: yearly.pendingLopDays,
  };
}

async function getActiveEmployeesForBalanceReport(): Promise<Employee[]> {
  const NO_BLOBS = { projection: { documents: 0, 'photo.data': 0 } };
  const docs = await getDB()
    .collection('employees')
    .find(
      {
        $or: [{ status: { $exists: false } }, { status: { $nin: ['Archived'] } }],
      },
      NO_BLOBS,
    )
    .sort({ firstName: 1, lastName: 1 })
    .toArray();

  return docs
    .map((doc) => {
      const employee = doc as Employee & { _id?: { toString(): string } };
      if (!employee.id && employee._id) {
        employee.id = String(employee._id);
      }
      return employee;
    })
    .filter((employee) => Boolean(employee.id));
}

async function computeEmployeeYearBalances(
  employee: Employee,
  year: number,
): Promise<LeaveTypeBalanceSummary[]> {
  const refDate = resolveRefDateForCalendarYear(year);
  const internalId = String(employee.id ?? '');
  const leaves = await getAllLeaves(internalId);
  const archivedEarned = await getArchivedEarnedLeavesForBalance(internalId, refDate);
  const compCredits = await getCompensationLeaveCreditsForYear(internalId, year);
  return computeEmployeeYearBalancesFromData(employee, year, leaves, archivedEarned, compCredits);
}

async function computeEmployeeLopForBalanceView(
  employee: Employee,
  calendarYear: number,
  monthRefDate = new Date(),
): Promise<{ lopDays: number; lopThisMonth: number; lopApproved: number; lopPending: number }> {
  const internalId = String(employee.id ?? '');
  const leaves = await getAllLeaves(internalId);
  const compCreditsYear = await getCompensationLeaveCreditsForYear(internalId, calendarYear);
  const compCreditsMonth = await getCompensationLeaveCreditsForYear(
    internalId,
    monthRefDate.getFullYear(),
  );
  return computeEmployeeLopForBalanceViewFromData(
    employee,
    calendarYear,
    leaves,
    compCreditsYear,
    compCreditsMonth,
    monthRefDate,
  );
}

function buildYearLeaveBalanceRow(
  employee: Employee,
  calendarYear: number,
  balances: LeaveTypeBalanceSummary[],
  lop: { lopDays: number; lopThisMonth: number; lopApproved: number; lopPending: number },
): YearLeaveBalanceRow {
  return {
    internalId: String(employee.id),
    employeeId: employee.employeeId ? String(employee.employeeId) : String(employee.id),
    employeeName: employeeDisplayName(employee),
    department: employee.department ? String(employee.department) : undefined,
    balances,
    lopDays: lop.lopDays,
    lopThisMonth: lop.lopThisMonth,
    lopApproved: lop.lopApproved,
    lopPending: lop.lopPending,
  };
}

export async function getAllEmployeesYearLeaveBalances(
  year: number,
): Promise<{ year: number; employees: YearLeaveBalanceRow[] }> {
  const calendarYear = Math.floor(Number(year));
  if (Number.isNaN(calendarYear) || calendarYear < 2000 || calendarYear > 2100) {
    throw new Error('Invalid calendar year');
  }

  const monthRefDate = new Date();
  const employees = await getActiveEmployeesForBalanceReport();
  const [allLeaves, archivedEarnedLeaves, compensationEntries, users] = await Promise.all([
    getLeaveCol().find({}).toArray(),
    getDB()
      .collection('leave_archives')
      .find({
        type: 'Earned Leave',
        status: 'Approved',
        from: { $regex: `^${calendarYear}` },
      })
      .toArray(),
    compensationCol().find({ status: 'Active' }).toArray(),
    getDB()
      .collection('users')
      .find({}, { projection: { id: 1, email: 1 } })
      .toArray(),
  ]);

  const tokenToInternal = buildEmployeeTokenIndex(employees, users as Array<{ id?: string; email?: string }>);
  const leavesByEmployee = groupRecordsByInternalEmployeeId(allLeaves as LeaveRequest[], tokenToInternal);
  const archivedByEmployee = groupRecordsByInternalEmployeeId(
    archivedEarnedLeaves as LeaveRequest[],
    tokenToInternal,
  );
  const tokensByInternal = new Map<string, string[]>();
  for (const [token, internalId] of tokenToInternal) {
    const list = tokensByInternal.get(internalId) ?? [];
    list.push(token);
    tokensByInternal.set(internalId, list);
  }

  const rows: YearLeaveBalanceRow[] = [];

  for (const employee of employees) {
    if (!employee.id) continue;
    const internalId = String(employee.id);
    try {
      const leaves = leavesByEmployee.get(internalId) ?? [];
      const archivedEarned = archivedByEmployee.get(internalId) ?? [];
      const employeeTokens = tokensByInternal.get(internalId) ?? [internalId];
      const compCreditsYear = sumCompensationCreditsForTokens(
        compensationEntries as Array<{ employeeId?: string; days?: number; appliedDate?: string }>,
        employeeTokens,
        calendarYear,
      );
      const compCreditsMonth = sumCompensationCreditsForTokens(
        compensationEntries as Array<{ employeeId?: string; days?: number; appliedDate?: string }>,
        employeeTokens,
        monthRefDate.getFullYear(),
      );

      const balances = await computeEmployeeYearBalancesFromData(
        employee,
        calendarYear,
        leaves,
        archivedEarned,
        compCreditsYear,
      );
      const lop = await computeEmployeeLopForBalanceViewFromData(
        employee,
        calendarYear,
        leaves,
        compCreditsYear,
        compCreditsMonth,
        monthRefDate,
      );
      rows.push(buildYearLeaveBalanceRow(employee, calendarYear, balances, lop));
    } catch (error) {
      console.error(
        `[leave] year balance row failed for employee ${employee.id}:`,
        error instanceof Error ? error.message : error,
      );
      // Still surface the employee so the year-balances list is complete.
      rows.push(
        buildYearLeaveBalanceRow(
          employee,
          calendarYear,
          YEAR_BALANCE_TYPES.map((type) => ({
            type,
            total:
              type === 'Casual Leave'
                ? LEAVE_ALLOCATIONS['Casual Leave']
                : type === 'Sick Leave'
                  ? LEAVE_ALLOCATIONS['Sick Leave']
                  : 0,
            used: 0,
            pending: 0,
            remaining:
              type === 'Casual Leave'
                ? LEAVE_ALLOCATIONS['Casual Leave']
                : type === 'Sick Leave'
                  ? LEAVE_ALLOCATIONS['Sick Leave']
                  : 0,
            usedThisMonth: 0,
          })),
          { lopDays: 0, lopThisMonth: 0, lopApproved: 0, lopPending: 0 },
        ),
      );
    }
  }

  return { year: calendarYear, employees: rows };
}

async function computeRawUsedForYear(
  employee: Employee,
  year: number,
  type: YearBalanceType,
): Promise<number> {
  const refDate = resolveRefDateForCalendarYear(year);
  const internalId = String(employee.id);
  const leaves = await getAllLeaves(internalId);
  const archivedEarned = await getArchivedEarnedLeavesForBalance(internalId, refDate);
  const compCredits = await getCompensationLeaveCreditsForYear(internalId, year);

  const balances = calculateBalances(
    [...leaves, ...archivedEarned],
    employee.joinedAt as string | undefined,
    {
      ...(await leaveBalanceOptions(employee, compCredits, refDate)),
      balanceUsedAdjustments: {},
    },
  );

  return balances[type]?.used ?? 0;
}

export async function updateEmployeeYearLeaveBalances(
  employeeId: string,
  year: number,
  updates: YearLeaveBalanceUpdate[],
  adjustedBy = 'Admin',
): Promise<YearLeaveBalanceRow> {
  const calendarYear = Math.floor(Number(year));
  if (Number.isNaN(calendarYear) || calendarYear < 2000 || calendarYear > 2100) {
    throw new Error('Invalid calendar year');
  }
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error('At least one balance update is required');
  }

  const employee = await findEmployeeDoc(employeeId);
  if (!employee?.id) {
    throw new Error('Employee not found');
  }

  const refDate = resolveRefDateForCalendarYear(calendarYear);
  const yearStr = String(calendarYear);
  const currentYear = new Date().getFullYear();
  const allocationPayload: Partial<Record<'Casual Leave' | 'Sick Leave' | 'Earned Leave', number>> =
    {};

  const adjustmentsByYear: Record<string, Record<string, number>> = {
    ...(employee.leaveBalanceAdjustments ?? {}),
  };
  const yearAdjustments: Record<string, number> = { ...(adjustmentsByYear[yearStr] ?? {}) };
  const currentBalances = await computeEmployeeYearBalances(employee, calendarYear);
  const allocationActivityEntries: Omit<LeaveAllocationActivity, 'id' | 'createdAt'>[] = [];
  let earnedLeaveAccrualPayload: { year: number; monthsAccrued: number; total: number } | undefined;

  for (const update of updates) {
    if (!YEAR_BALANCE_TYPES.includes(update.type)) {
      throw new Error(`Invalid leave type: ${update.type}`);
    }

    if (update.total !== undefined) {
      if (update.type === 'Compensation Leave') {
        throw new Error('Compensation Leave total is managed via compensation credits');
      }
      if (calendarYear !== currentYear) {
        throw new Error('Annual allotment can only be edited for the current calendar year');
      }
      const total = Number(update.total);
      if (Number.isNaN(total) || total < 0) {
        throw new Error(`${update.type} total must be a non-negative number`);
      }
      assertLeaveBalanceStep(update.type, total, 'total');

      if (update.type === 'Earned Leave') {
        // Rebase the persisted accrual checkpoint instead of writing into leaveAllocations,
        // which would otherwise permanently freeze future monthly accrual for this employee
        // (see resolveEarnedLeaveTotal).
        const monthsNow = monthsWorkedInCurrentYear(
          employee.joinedAt as string | undefined,
          refDate,
          employee.earnedLeaveMonthEndAccrual !== false,
        );
        earnedLeaveAccrualPayload = { year: calendarYear, monthsAccrued: monthsNow, total };
      } else {
        allocationPayload[update.type as 'Casual Leave' | 'Sick Leave'] = total;
      }

      const previousTotal =
        currentBalances.find((balance) => balance.type === update.type)?.total ?? 0;
      if (previousTotal !== total) {
        allocationActivityEntries.push({
          employeeInternalId: String(employee.id),
          employeeId: employee.employeeId ? String(employee.employeeId) : String(employee.id),
          employeeName: employeeDisplayName(employee),
          leaveType: update.type,
          previousTotal,
          newTotal: total,
          year: calendarYear,
          adjustedBy,
        });
      }
    }

    if (update.used !== undefined) {
      const desiredUsed = Number(update.used);
      if (Number.isNaN(desiredUsed) || desiredUsed < 0) {
        throw new Error(`${update.type} used days must be a non-negative number`);
      }

      const compCredits = await getCompensationLeaveCreditsForYear(String(employee.id), calendarYear);
      const leaves = await getAllLeaves(String(employee.id));
      const archivedEarned = await getArchivedEarnedLeavesForBalance(String(employee.id), refDate);
      const resolvedOptions = await leaveBalanceOptions(employee, compCredits, refDate);
      const nextAllocations = {
        ...resolvedOptions.employeeAllocations,
        ...allocationPayload,
        ...(earnedLeaveAccrualPayload ? { 'Earned Leave': earnedLeaveAccrualPayload.total } : {}),
      };

      const totals = calculateBalances([], employee.joinedAt as string | undefined, {
        ...resolvedOptions,
        employeeAllocations: nextAllocations,
      });

      const totalForType = totals[update.type]?.total ?? 0;
      if (desiredUsed > totalForType) {
        throw new Error(`${update.type} used cannot exceed total (${totalForType})`);
      }

      const rawUsed = await computeRawUsedForYear(employee, calendarYear, update.type);
      const nextAdjustment = desiredUsed - rawUsed;

      if (nextAdjustment === 0) {
        delete yearAdjustments[update.type];
      } else {
        yearAdjustments[update.type] = nextAdjustment;
      }

      const provisionalBalances = calculateBalances(
        [...leaves, ...archivedEarned],
        employee.joinedAt as string | undefined,
        {
          ...resolvedOptions,
          employeeAllocations: nextAllocations,
          balanceUsedAdjustments: yearAdjustments,
        },
      );

      const bucket = provisionalBalances[update.type];
      if (!bucket || bucket.used < 0 || bucket.remaining < 0) {
        throw new Error('Invalid balance after adjustment');
      }
    }
  }

  if (Object.keys(allocationPayload).length > 0 || earnedLeaveAccrualPayload) {
    const setDoc: Record<string, unknown> = { updatedAt: new Date() };
    if (Object.keys(allocationPayload).length > 0) {
      setDoc.leaveAllocations = { ...(employee.leaveAllocations ?? {}), ...allocationPayload };
    }
    if (earnedLeaveAccrualPayload) {
      setDoc.earnedLeaveAccrual = earnedLeaveAccrualPayload;
    }
    await getDB()
      .collection('employees')
      .updateOne({ id: String(employee.id) }, { $set: setDoc });

    if (Object.keys(allocationPayload).length > 0) {
      employee.leaveAllocations = { ...(employee.leaveAllocations ?? {}), ...allocationPayload };
    }
    if (earnedLeaveAccrualPayload) {
      employee.earnedLeaveAccrual = earnedLeaveAccrualPayload;
    }
  }

  if (Object.keys(yearAdjustments).length === 0) {
    delete adjustmentsByYear[yearStr];
  } else {
    adjustmentsByYear[yearStr] = yearAdjustments;
  }

  const adjustmentUpdate =
    Object.keys(adjustmentsByYear).length === 0
      ? { $unset: { leaveBalanceAdjustments: '' }, $set: { updatedAt: new Date() } }
      : { $set: { leaveBalanceAdjustments: adjustmentsByYear, updatedAt: new Date() } };

  await getDB().collection('employees').updateOne({ id: String(employee.id) }, adjustmentUpdate);

  await recordLeaveAllocationActivities(allocationActivityEntries);

  const refreshed = await getDB()
    .collection('employees')
    .findOne({ id: String(employee.id) }, { projection: { documents: 0, 'photo.data': 0 } });

  const balances = await computeEmployeeYearBalances(
    (refreshed ?? employee) as Employee,
    calendarYear,
  );
  const lop = await computeEmployeeLopForBalanceView(
    (refreshed ?? employee) as Employee,
    calendarYear,
  );

  return buildYearLeaveBalanceRow(
    (refreshed ?? employee) as Employee,
    calendarYear,
    balances,
    lop,
  );
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

  const trimmedRejectionReason =
    status === 'Rejected' ? rejectionReason?.trim() : undefined;

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
    const balanceOptions = await leaveBalanceOptions(employeeDoc as Employee | null, compCredits);
    const balances = calculateBalances(
      employeeLeaves,
      (employeeDoc as Employee | null)?.joinedAt as string | undefined,
      balanceOptions,
    );

    if (leave.type === 'Sick Leave') {
      const split = computeSickLeaveLopForRequest(
        leave.days,
        employeeLeaves,
        (employeeDoc as Employee | null)?.joinedAt as string | undefined,
        balanceOptions,
        leave.id,
      );
      updateDoc.lopDays = split.lopDays;
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
        leave.createdAt ?? leave.updatedAt,
      );
      updateDoc.lopDays = split.lopDays;
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

  if (status === 'Rejected' && trimmedRejectionReason) {
    updateDoc.rejectionReason = trimmedRejectionReason;
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
          : trimmedRejectionReason
            ? `Your ${result.type} leave request from ${result.from} to ${result.to} has been rejected. Reason: ${trimmedRejectionReason}`
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
          ...(trimmedRejectionReason ? { rejectionReason: trimmedRejectionReason } : {}),
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
      const reasonSuffix = cancelReason?.trim() ? ` Reason: ${cancelReason.trim()}` : '';
      await notificationService.notifyAllAdmins({
        type: 'LeaveCancelled',
        title: 'Leave Cancelled by Employee',
        message: `${result.employeeName} cancelled their ${result.type} leave (${result.from} to ${result.to}).${reasonSuffix}`,
        relatedData: {
          leaveId: id,
          employeeId: result.employeeId,
          employeeName: result.employeeName,
        },
      });
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

const LEAVE_ANNUAL_RESET_SETTINGS_KEY = 'leaveAnnualResetYear';

/**
 * DISABLED — leave request history must never be deleted.
 * Kept only so older call sites fail safely / no-op.
 */
export async function archiveAndDeleteLeavesBeforeMonth(_cutoffMonthKey: string): Promise<{
  archivedCount: number;
  deletedCount: number;
}> {
  console.warn(
    '[LeaveReset] archiveAndDeleteLeavesBeforeMonth blocked — leave history is retained permanently.',
  );
  return { archivedCount: 0, deletedCount: 0 };
}

/** DISABLED — leave history is retained; only annual allotment/adjustments reset at year change. */
export async function runMonthlyLeaveHistoryReset(): Promise<{
  deletedCount: number;
  archivedCount: number;
  monthKey: string;
}> {
  const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  console.warn(
    `[LeaveReset] runMonthlyLeaveHistoryReset blocked for ${monthKey} — leave history is retained permanently.`,
  );
  return { deletedCount: 0, archivedCount: 0, monthKey };
}

/** Disabled — leave request logs are kept permanently; balances reset yearly only. */
export async function ensureMonthlyLeaveHistoryReset(): Promise<{ ran: boolean; deletedCount?: number }> {
  return { ran: false };
}

async function getLastLeaveAnnualResetYear(): Promise<number | null> {
  const doc = await getDB().collection('app_settings').findOne({ key: LEAVE_ANNUAL_RESET_SETTINGS_KEY });
  if (!doc?.value) return null;
  const parsed = Number(doc.value);
  return Number.isNaN(parsed) ? null : parsed;
}

async function setLastLeaveAnnualResetYear(year: number): Promise<void> {
  await getDB()
    .collection('app_settings')
    .updateOne(
      { key: LEAVE_ANNUAL_RESET_SETTINGS_KEY },
      { $set: { key: LEAVE_ANNUAL_RESET_SETTINGS_KEY, value: year, updatedAt: new Date() } },
      { upsert: true },
    );
}

/** Clears prior-year manual balance adjustments so all leave types reset each calendar year. */
async function clearStaleLeaveBalanceAdjustments(currentYear: number): Promise<number> {
  const yearStr = String(currentYear);
  const col = getDB().collection('employees');
  const employees = await col
    .find({ leaveBalanceAdjustments: { $exists: true } })
    .project({ id: 1, leaveBalanceAdjustments: 1 })
    .toArray();

  let updated = 0;
  for (const emp of employees) {
    const raw = emp.leaveBalanceAdjustments as Record<string, Record<string, number>> | undefined;
    if (!raw) continue;

    const next: Record<string, Record<string, number>> = {};
    for (const [y, values] of Object.entries(raw)) {
      if (y >= yearStr) next[y] = values;
    }

    if (Object.keys(next).length === Object.keys(raw).length) continue;

    if (Object.keys(next).length === 0) {
      await col.updateOne({ id: emp.id }, { $unset: { leaveBalanceAdjustments: '' }, $set: { updatedAt: new Date() } });
    } else {
      await col.updateOne({ id: emp.id }, { $set: { leaveBalanceAdjustments: next, updatedAt: new Date() } });
    }
    updated++;
  }
  return updated;
}

/** Runs once per calendar year (typically Jan 1) to reset leave balances for the new year. */
export async function ensureAnnualLeaveBalanceReset(refDate = new Date()): Promise<{
  ran: boolean;
  clearedEmployees?: number;
}> {
  const currentYear = refDate.getFullYear();
  const last = await getLastLeaveAnnualResetYear();

  if (last !== null && last >= currentYear) {
    return { ran: false };
  }

  const clearedEmployees = await clearStaleLeaveBalanceAdjustments(currentYear);
  await setLastLeaveAnnualResetYear(currentYear);

  if (last !== null) {
    console.log(
      `[LeaveReset] Annual balance reset for ${currentYear}: cleared adjustments on ${clearedEmployees} employee(s)`,
    );
  }

  return { ran: last !== null, clearedEmployees };
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

/** Create many holidays in one duplicate check + insertMany. */
export async function createHolidaysBulk(
  payload: { title: string; type: HolidayType; description?: string },
  dates: string[],
): Promise<{ created: Holiday[]; skippedDates: string[] }> {
  const uniqueDates = Array.from(new Set(dates.map((d) => String(d).trim()).filter(Boolean)));
  if (uniqueDates.length === 0) return { created: [], skippedDates: [] };

  const col = getHolidayCol();
  const existing = await col
    .find({ date: { $in: uniqueDates } })
    .project({ date: 1 })
    .toArray();
  const existingDates = new Set(existing.map((row) => String(row.date)));
  const skippedDates = uniqueDates.filter((date) => existingDates.has(date));
  const toCreate = uniqueDates.filter((date) => !existingDates.has(date));
  if (toCreate.length === 0) return { created: [], skippedDates };

  const now = new Date();
  const created: Holiday[] = toCreate.map((date, index) => ({
    id: `H-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    title: payload.title,
    date,
    type: payload.type,
    description: payload.description,
    createdAt: now,
    updatedAt: now,
  }));
  await col.insertMany(created as any[]);
  return { created, skippedDates };
}

export type BulkHolidayImportSkipped = {
  rowNumber: number;
  date: string;
  title: string;
  reason: string;
};

export async function bulkImportHolidays(
  rows: Array<{
    rowNumber: number;
    fromDate: string;
    toDate: string | null;
    title: string;
    type: HolidayType;
  }>,
  expandDates: (fromDate: string, toDate: string | null) => string[],
): Promise<{
  created: Holiday[];
  skipped: BulkHolidayImportSkipped[];
  summary: Array<{ title: string; type: HolidayType; fromDate: string; toDate: string | null }>;
}> {
  const created: Holiday[] = [];
  const skipped: BulkHolidayImportSkipped[] = [];
  const summary: Array<{ title: string; type: HolidayType; fromDate: string; toDate: string | null }> = [];

  for (const row of rows) {
    const dates = expandDates(row.fromDate, row.toDate);
    let rowCreated = 0;
    const { created: batchCreated, skippedDates } = await createHolidaysBulk(
      { title: row.title, type: row.type },
      dates,
    );
    for (const date of skippedDates) {
      skipped.push({
        rowNumber: row.rowNumber,
        date,
        title: row.title,
        reason: 'Holiday already exists on this date',
      });
    }
    created.push(...batchCreated);
    rowCreated = batchCreated.length;

    if (rowCreated > 0) {
      summary.push({
        title: row.title,
        type: row.type,
        fromDate: row.fromDate,
        toDate: row.toDate,
      });
    }
  }

  return { created, skipped, summary };
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
    const admins = await notificationService.listAdminNotificationRecipients();

    await Promise.all(
      admins
        .filter((admin) => Boolean(admin.recipientEmail))
        .map((admin) =>
          emailService.sendLeaveSubmittedEmail({
            recipientEmail: admin.recipientEmail!,
            recipientName: admin.recipientName || 'Admin',
            employeeName: leave.employeeName,
            type: leave.type,
            from: leave.from,
            to: leave.to,
            days: leave.days,
            reason: leave.reason,
          }, `${env.FRONTEND_URL}/admin/leaves`),
        ),
    );
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
    
    if (!employee) {
      console.warn(`[Leave Email] No employee found for ${leave.employeeId}`);
      return;
    }

    const recipientEmail = getEmployeeOfficialEmail(employee as { email?: string; personalEmail?: string });
    if (!recipientEmail) {
      console.warn(`[Leave Email] No email found for employee ${leave.employeeId}`);
      return;
    }
    
    await emailService.sendLeaveStatusEmail({
      recipientEmail,
      recipientName: `${(employee as any).firstName} ${(employee as any).lastName}`,
      employeeName: leave.employeeName,
      type: leave.type,
      from: leave.from,
      to: leave.to,
      days: leave.days,
      status: leave.status,
      rejectionReason: leave.rejectionReason,
    }, `${env.FRONTEND_URL}/employee/leave`);
    
  } catch (error) {
    console.error('[Leave Email] Error sending employee notification:', error);
  }
}

export async function purgeCancelledLeavesFromDatabase(): Promise<number> {
  const col = getLeaveCol();
  const result = await col.deleteMany({ status: 'Cancelled' });
  return result.deletedCount;
}

