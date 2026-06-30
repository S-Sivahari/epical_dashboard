import { Holiday } from '../models/Holiday';
import { LeaveRequest } from '../models/Leave';
import { eachIsoDateInRange, isWeekendIso } from './dateValidation';

export const LEAVE_ALLOCATIONS = {
  'Casual Leave': 12,
  'Sick Leave': 6,
};

export const EARNED_LEAVE_ACCRUAL_PER_MONTH = 0.5;

export const LOP_LEAVE_TYPE = 'LOP';

export type LeaveAllocationType =
  | 'Casual Leave'
  | 'Sick Leave'
  | 'Earned Leave'
  | 'Compensation Leave';

export interface LeaveBalanceOptions {
  /** Admin-credited compensation leave days for the calendar year (from compensation entries only). */
  compensationLeaveCredits?: number;
  /** @deprecated Use compensationLeaveCredits */
  compensationEarnedBonus?: number;
  /** Admin-defined per-employee allotment overrides (Casual, Sick, Earned only — not Compensation). */
  employeeAllocations?: Partial<Record<'Casual Leave' | 'Sick Leave' | 'Earned Leave', number>>;
  /** Admin manual used-day adjustments for the refDate calendar year. */
  balanceUsedAdjustments?: Partial<Record<string, number>>;
  /** When true, earned leave stays 0 until each calendar month completes (new employees). */
  earnedLeaveMonthEndAccrual?: boolean;
  /** Defaults to today; useful for reports. */
  refDate?: Date;
}

export interface LopSummary {
  approvedLopDays: number;
  pendingLopDays: number;
  totalLopDays: number;
}

/** Map leave request type to the balance bucket that should be checked or debited. */
export function resolveLeaveBalanceKey(type: string): string {
  if (type === LOP_LEAVE_TYPE) return LOP_LEAVE_TYPE;
  return type;
}

export function isoDateFromRef(refDate = new Date()): string {
  const y = refDate.getFullYear();
  const m = String(refDate.getMonth() + 1).padStart(2, '0');
  const d = String(refDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Calendar date yyyy-MM-dd from when the leave request was submitted. */
export function isoDateFromAppliedAt(appliedAt: Date | string): string {
  if (typeof appliedAt === 'string') {
    const trimmed = appliedAt.trim();
    if (trimmed.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return isoDateFromRef(parsed);
    return isoDateFromRef();
  }
  return isoDateFromRef(appliedAt);
}

/** Casual leave submitted on the same calendar day as the leave start date is LOP. */
export function isCasualSameDayLeave(
  fromDate: string,
  appliedAt: Date | string = new Date(),
): boolean {
  if (!fromDate || fromDate.length < 10) return false;
  return fromDate.slice(0, 10) === isoDateFromAppliedAt(appliedAt);
}

function resolveCompensationLeaveCredits(options?: LeaveBalanceOptions): number {
  const raw =
    options?.compensationLeaveCredits ?? options?.compensationEarnedBonus ?? 0;
  return Math.max(0, Number(raw) || 0);
}

export function resolveLeaveAllocationTotals(
  employeeAllocations?: Partial<Record<string, number>>,
  joinedAt?: string,
  refDate = new Date(),
  compensationLeaveCredits = 0,
  earnedLeaveMonthEndAccrual = true,
): Record<LeaveAllocationType, number> {
  const credits = Math.max(0, Number(compensationLeaveCredits) || 0);
  const earnedOverride = employeeAllocations?.['Earned Leave'];
  const earnedTotal =
    earnedOverride !== undefined && earnedOverride !== null && !Number.isNaN(Number(earnedOverride))
      ? Math.max(0, Number(earnedOverride))
      : calculateEarnedLeaveAllocation(joinedAt, refDate, earnedLeaveMonthEndAccrual);

  return {
    'Casual Leave': Math.max(
      0,
      Number(employeeAllocations?.['Casual Leave'] ?? LEAVE_ALLOCATIONS['Casual Leave']) || 0,
    ),
    'Sick Leave': Math.max(
      0,
      Number(employeeAllocations?.['Sick Leave'] ?? LEAVE_ALLOCATIONS['Sick Leave']) || 0,
    ),
    'Earned Leave': earnedTotal,
    'Compensation Leave': credits,
  };
}

/** Calendar year suffix for yyyy-MM-dd id strings */
export function leaveYear(dateStr: string): string {
  return dateStr.slice(0, 4);
}

/** Calendar month yyyy-MM from yyyy-MM-dd */
export function leaveMonth(dateStr: string): string {
  return dateStr.length >= 7 ? dateStr.slice(0, 7) : '';
}

export function currentLeaveMonthKey(refDate = new Date()): string {
  const y = refDate.getFullYear();
  const m = String(refDate.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

const YEARLY_LEAVE_TYPES = new Set(['Casual Leave', 'Sick Leave', 'Earned Leave', 'Compensation Leave']);

/**
 * Parse yyyy-MM-dd join date for accrual (UTC noon avoids DST edge cases).
 */
function parseJoinDate(joinedAt: string): { year: number; month: number; day: number } | null {
  const join = new Date(`${joinedAt.trim()}T12:00:00Z`);
  if (Number.isNaN(join.getTime())) return null;
  return { year: join.getUTCFullYear(), month: join.getUTCMonth(), day: join.getUTCDate() };
}

/** True when the employee was employed for the entire calendar month. */
function wasEmployedFullCalendarMonth(
  joinedAt: string | undefined,
  year: number,
  monthIndex: number,
): boolean {
  if (!joinedAt?.trim()) return false;
  const join = parseJoinDate(joinedAt);
  if (!join) return false;
  if (join.year > year) return false;
  if (join.year < year) return true;
  if (join.month > monthIndex) return false;
  if (join.month < monthIndex) return true;
  return join.day <= 1;
}

/** Last moment of a calendar month (local time). */
function endOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
}

/**
 * Completed calendar months for earned-leave accrual in the current year.
 * Accrues 0.5 day only after a full calendar month of employment ends
 * (e.g. join 15 Jun → 0 EL on 1 Jul; 0.5 on 1 Aug after completing July).
 */
export function monthsWorkedInCurrentYear(
  joinedAt?: string,
  refDate = new Date(),
  earnedLeaveMonthEndAccrual = true,
): number {
  const year = refDate.getFullYear();
  const refMs = refDate.getTime();
  const currentMonthIdx = refDate.getMonth();

  let firstMonth = 0;

  if (joinedAt?.trim()) {
    const join = parseJoinDate(joinedAt);
    if (!join) return 0;
    if (join.year > year) return 0;
    if (join.year === year && join.month > currentMonthIdx) return 0;
    if (join.year === year) {
      firstMonth = join.day > 1 ? join.month + 1 : join.month;
    }
  } else {
    return 0;
  }

  let completed = 0;
  for (let month = firstMonth; month <= currentMonthIdx; month++) {
    if (!wasEmployedFullCalendarMonth(joinedAt, year, month)) continue;
    if (earnedLeaveMonthEndAccrual) {
      if (refMs > endOfMonth(year, month).getTime()) {
        completed++;
      }
    } else {
      completed++;
    }
  }
  return completed;
}

/** Earned Leave accrues 0.5 day per completed calendar month (resets each year). */
export function calculateEarnedLeaveAllocation(
  joinedAt?: string,
  refDate = new Date(),
  earnedLeaveMonthEndAccrual = true,
): number {
  return (
    monthsWorkedInCurrentYear(joinedAt, refDate, earnedLeaveMonthEndAccrual) *
    EARNED_LEAVE_ACCRUAL_PER_MONTH
  );
}

function paidLeaveDays(leave: LeaveRequest): number {
  const lop = Number(leave.lopDays ?? 0) || 0;
  return Math.max(0, leave.days - lop);
}

function paidCasualDays(
  leave: LeaveRequest,
  employeeLeaves?: LeaveRequest[],
  joinedAt?: string,
  options?: LeaveBalanceOptions,
): number {
  const lop =
    leave.type === 'Casual Leave' && employeeLeaves
      ? resolveCasualLeaveLopDays(leave, employeeLeaves, joinedAt, options)
      : Number(leave.lopDays ?? 0) || 0;
  return Math.max(0, leave.days - lop);
}

function paidSickDays(leave: LeaveRequest): number {
  return paidLeaveDays(leave);
}

/** LOP days for casual leave — based on application date, not approval date. */
export function resolveCasualLeaveLopDays(
  leave: LeaveRequest,
  employeeLeaves: LeaveRequest[],
  joinedAt?: string,
  options?: LeaveBalanceOptions,
): number {
  if (leave.type !== 'Casual Leave') return Number(leave.lopDays ?? 0) || 0;
  const appliedAt = leave.createdAt ?? leave.updatedAt;
  if (!leave.from || !appliedAt) return Number(leave.lopDays ?? 0) || 0;
  return computeCasualLeaveLopForRequest(
    leave.days,
    employeeLeaves,
    joinedAt,
    options,
    leave.id,
    leave.from,
    appliedAt,
  ).lopDays;
}

function isLeaveInCurrentMonth(leave: LeaveRequest, calendarMonth: string): boolean {
  return typeof leave.from === 'string' && leave.from.length >= 7 && leaveMonth(leave.from) === calendarMonth;
}

/** Sum pending leave days for a type in the current calendar month (or year for earned/compensation). */
export function sumPendingLeaveDays(
  employeeLeaves: LeaveRequest[],
  type: string,
  refDate = new Date(),
  excludeLeaveId?: string,
): number {
  const calendarYear = String(refDate.getFullYear());
  const isYearlyType = YEARLY_LEAVE_TYPES.has(type);

  return employeeLeaves.reduce((sum, leave) => {
    if (leave.status !== 'Pending') return sum;
    if (leave.type !== type) return sum;
    if (excludeLeaveId && leave.id === excludeLeaveId) return sum;
    if (typeof leave.from !== 'string' || leave.from.length < 7) return sum;
    if (isYearlyType) {
      if (leaveYear(leave.from) !== calendarYear) return sum;
    } else if (leaveMonth(leave.from) !== currentLeaveMonthKey(refDate)) {
      return sum;
    }
    return sum + leave.days;
  }, 0);
}

/** How much casual credit is already consumed this calendar year (paid days only). */
export function casualCreditUsedThisMonth(
  employeeLeaves: LeaveRequest[],
  refDate = new Date(),
  excludeLeaveId?: string,
  joinedAt?: string,
  options?: LeaveBalanceOptions,
): number {
  const calendarYear = String(refDate.getFullYear());
  return employeeLeaves.reduce((sum, leave) => {
    if (leave.type !== 'Casual Leave') return sum;
    if (leave.status !== 'Approved' && leave.status !== 'Pending') return sum;
    if (excludeLeaveId && leave.id === excludeLeaveId) return sum;
    if (typeof leave.from !== 'string' || leave.from.length < 4) return sum;
    if (leaveYear(leave.from) !== calendarYear) return sum;
    if (leave.status === 'Approved' || leave.status === 'Pending') {
      return sum + paidCasualDays(leave, employeeLeaves, joinedAt, options);
    }
    return sum;
  }, 0);
}

/** How much sick credit is already consumed this calendar year (paid days only). */
export function sickCreditUsedThisMonth(
  employeeLeaves: LeaveRequest[],
  refDate = new Date(),
  excludeLeaveId?: string,
): number {
  const calendarYear = String(refDate.getFullYear());
  return employeeLeaves.reduce((sum, leave) => {
    if (leave.type !== 'Sick Leave') return sum;
    if (leave.status !== 'Approved' && leave.status !== 'Pending') return sum;
    if (excludeLeaveId && leave.id === excludeLeaveId) return sum;
    if (typeof leave.from !== 'string' || leave.from.length < 4) return sum;
    if (leaveYear(leave.from) !== calendarYear) return sum;
    if (leave.status === 'Approved') {
      return sum + paidSickDays(leave);
    }
    const lop = Number(leave.lopDays ?? NaN);
    if (!Number.isNaN(lop)) {
      return sum + Math.max(0, leave.days - lop);
    }
    return sum + leave.days;
  }, 0);
}

/** Compute paid vs LOP split for a new or pending casual leave request. */
export function computeCasualLeaveLopForRequest(
  requestedDays: number,
  employeeLeaves: LeaveRequest[],
  joinedAt?: string,
  options?: LeaveBalanceOptions,
  excludeLeaveId?: string,
  fromDate?: string,
  appliedAt?: Date | string,
): { paidDays: number; lopDays: number } {
  const refDate = options?.refDate ?? new Date();
  const applied = appliedAt ?? new Date();
  if (fromDate && isCasualSameDayLeave(fromDate, applied)) {
    return { paidDays: 0, lopDays: requestedDays };
  }
  const compensationCredits = resolveCompensationLeaveCredits(options);
  const totals = resolveLeaveAllocationTotals(
    options?.employeeAllocations,
    joinedAt,
    refDate,
    compensationCredits,
    options?.earnedLeaveMonthEndAccrual ?? true,
  );
  const casualTotal = totals['Casual Leave'];
  const consumed = casualCreditUsedThisMonth(
    employeeLeaves,
    refDate,
    excludeLeaveId,
    joinedAt,
    options,
  );
  const remaining = Math.max(0, casualTotal - consumed);
  const paidDays = Math.min(requestedDays, remaining);
  const lopDays = Math.max(0, requestedDays - paidDays);
  return { paidDays, lopDays };
}

/** Compute paid vs LOP split for a sick leave request (same-day allowed). */
export function computeSickLeaveLopForRequest(
  requestedDays: number,
  employeeLeaves: LeaveRequest[],
  joinedAt?: string,
  options?: LeaveBalanceOptions,
  excludeLeaveId?: string,
): { paidDays: number; lopDays: number } {
  const refDate = options?.refDate ?? new Date();
  const compensationCredits = resolveCompensationLeaveCredits(options);
  const totals = resolveLeaveAllocationTotals(
    options?.employeeAllocations,
    joinedAt,
    refDate,
    compensationCredits,
    options?.earnedLeaveMonthEndAccrual ?? true,
  );
  const sickTotal = totals['Sick Leave'];
  const consumed = sickCreditUsedThisMonth(employeeLeaves, refDate, excludeLeaveId);
  const remaining = Math.max(0, sickTotal - consumed);
  const paidDays = Math.min(requestedDays, remaining);
  const lopDays = Math.max(0, requestedDays - paidDays);
  return { paidDays, lopDays };
}

/** Monthly LOP summary — resets each calendar month. */
export function calculateMonthlyLopSummary(
  employeeLeaves: LeaveRequest[],
  joinedAt?: string,
  options?: LeaveBalanceOptions,
): LopSummary {
  const refDate = options?.refDate ?? new Date();
  const calendarMonth = currentLeaveMonthKey(refDate);

  let approvedLopDays = 0;
  let pendingLopDays = 0;

  for (const leave of employeeLeaves) {
    if (!isLeaveInCurrentMonth(leave, calendarMonth)) continue;

    if (leave.type === LOP_LEAVE_TYPE) {
      if (leave.status === 'Approved') approvedLopDays += leave.days;
      else if (leave.status === 'Pending') pendingLopDays += leave.days;
      continue;
    }

    if (leave.type === 'Casual Leave' || leave.type === 'Sick Leave') {
      if (leave.status === 'Approved') {
        approvedLopDays +=
          leave.type === 'Casual Leave'
            ? resolveCasualLeaveLopDays(leave, employeeLeaves, joinedAt, options)
            : Number(leave.lopDays ?? 0) || 0;
        continue;
      }

      if (leave.status === 'Pending') {
        if (leave.type === 'Casual Leave') {
          pendingLopDays += resolveCasualLeaveLopDays(leave, employeeLeaves, joinedAt, options);
        } else {
          const stored = Number(leave.lopDays ?? NaN);
          if (!Number.isNaN(stored)) {
            pendingLopDays += stored;
          } else {
            const { lopDays } = computeSickLeaveLopForRequest(
              leave.days,
              employeeLeaves,
              joinedAt,
              options,
              leave.id,
            );
            pendingLopDays += lopDays;
          }
        }
      }
      continue;
    }
  }

  return {
    approvedLopDays,
    pendingLopDays,
    totalLopDays: approvedLopDays + pendingLopDays,
  };
}

function isLeaveInCalendarYear(leave: LeaveRequest, year: number): boolean {
  const yearStr = String(year);
  return Boolean(leave.from?.startsWith(yearStr));
}

/** Calendar-year LOP summary for admin balance views. */
export function calculateYearlyLopSummary(
  employeeLeaves: LeaveRequest[],
  year: number,
  joinedAt?: string,
  options?: LeaveBalanceOptions,
): LopSummary {
  let approvedLopDays = 0;
  let pendingLopDays = 0;

  for (const leave of employeeLeaves) {
    if (!isLeaveInCalendarYear(leave, year)) continue;

    if (leave.type === LOP_LEAVE_TYPE) {
      if (leave.status === 'Approved') approvedLopDays += leave.days;
      else if (leave.status === 'Pending') pendingLopDays += leave.days;
      continue;
    }

    if (leave.type === 'Casual Leave' || leave.type === 'Sick Leave') {
      if (leave.status === 'Approved') {
        approvedLopDays +=
          leave.type === 'Casual Leave'
            ? resolveCasualLeaveLopDays(leave, employeeLeaves, joinedAt, options)
            : Number(leave.lopDays ?? 0) || 0;
        continue;
      }

      if (leave.status === 'Pending') {
        if (leave.type === 'Casual Leave') {
          pendingLopDays += resolveCasualLeaveLopDays(leave, employeeLeaves, joinedAt, options);
        } else {
          const stored = Number(leave.lopDays ?? NaN);
          if (!Number.isNaN(stored)) {
            pendingLopDays += stored;
          } else {
            const { lopDays } = computeSickLeaveLopForRequest(
              leave.days,
              employeeLeaves,
              joinedAt,
              options,
              leave.id,
            );
            pendingLopDays += lopDays;
          }
        }
      }
    }
  }

  return {
    approvedLopDays,
    pendingLopDays,
    totalLopDays: approvedLopDays + pendingLopDays,
  };
}

function normalizeHolidayDate(date: string): string {
  return date.trim().slice(0, 10);
}

// Calculates total business days excluding weekends and provided holidays
export function getBusinessDays(from: string, to: string, holidays: Holiday[]): number {
  const dates = eachIsoDateInRange(from, to);
  if (dates.length === 0) return 0;

  const holidayDates = new Set(holidays.map((h) => normalizeHolidayDate(h.date)));
  let count = 0;

  for (const iso of dates) {
    if (!isWeekendIso(iso) && !holidayDates.has(iso)) {
      count++;
    }
  }

  return count;
}

export function calculateBalances(
  employeeLeaves: LeaveRequest[],
  joinedAt?: string,
  options?: LeaveBalanceOptions,
) {
  const refDate = options?.refDate ?? new Date();
  const compensationCredits = resolveCompensationLeaveCredits(options);
  const totals = resolveLeaveAllocationTotals(
    options?.employeeAllocations,
    joinedAt,
    refDate,
    compensationCredits,
    options?.earnedLeaveMonthEndAccrual ?? true,
  );

  const balances: Record<string, { total: number; used: number; remaining: number }> = {
    'Casual Leave': { total: totals['Casual Leave'], used: 0, remaining: totals['Casual Leave'] },
    'Sick Leave': { total: totals['Sick Leave'], used: 0, remaining: totals['Sick Leave'] },
    'Earned Leave': { total: totals['Earned Leave'], used: 0, remaining: totals['Earned Leave'] },
    'Compensation Leave': {
      total: totals['Compensation Leave'],
      used: 0,
      remaining: totals['Compensation Leave'],
    },
  };

  const calendarYear = String(refDate.getFullYear());

  employeeLeaves.forEach((leave) => {
    if (leave.status !== 'Approved' || typeof leave.from !== 'string' || leave.from.length < 7) {
      return;
    }

    if (leave.type === LOP_LEAVE_TYPE) return;

    const balanceKey = resolveLeaveBalanceKey(leave.type);
    if (leaveYear(leave.from) !== calendarYear) return;

    const debitDays =
      leave.type === 'Casual Leave'
        ? paidCasualDays(leave, employeeLeaves, joinedAt, options)
        : leave.type === 'Sick Leave'
          ? paidSickDays(leave)
          : leave.days;

    if (balances[balanceKey]) {
      balances[balanceKey].used += debitDays;
      balances[balanceKey].remaining -= debitDays;
    } else {
      balances[balanceKey] = { total: 0, used: debitDays, remaining: -debitDays };
    }
  });

  const adjustments = options?.balanceUsedAdjustments ?? {};
  for (const [type, rawDelta] of Object.entries(adjustments)) {
    const bucket = balances[type];
    if (!bucket) continue;
    const delta = Number(rawDelta) || 0;
    if (delta === 0) continue;
    bucket.used = Math.max(0, bucket.used + delta);
    bucket.remaining = bucket.total - bucket.used;
  }

  for (const key of Object.keys(balances)) {
    balances[key].used = Math.max(0, balances[key].used);
    balances[key].remaining = Math.max(0, balances[key].total - balances[key].used);
  }

  return balances;
}
