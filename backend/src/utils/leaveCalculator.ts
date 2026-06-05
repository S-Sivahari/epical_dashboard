import { Holiday } from '../models/Holiday';
import { LeaveRequest } from '../models/Leave';

export const LEAVE_ALLOCATIONS = {
  'Casual Leave': 12,
  'Sick Leave': 12,
};

export const EARNED_LEAVE_ACCRUAL_PER_MONTH = 0.5;

export type LeaveAllocationType =
  | 'Casual Leave'
  | 'Sick Leave'
  | 'Earned Leave'
  | 'Compensation Leave';

export interface LeaveBalanceOptions {
  /** Extra Earned Leave days granted via approved compensation entries (same calendar year as balances). */
  compensationEarnedBonus?: number;
  /** Admin-defined per-employee allotment overrides. */
  employeeAllocations?: Partial<Record<string, number>>;
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
  return type;
}

export function resolveLeaveAllocationTotals(
  employeeAllocations?: Partial<Record<string, number>>,
  joinedAt?: string,
  refDate = new Date(),
  compensationEarnedBonus = 0,
): Record<LeaveAllocationType, number> {
  const bonus = Math.max(0, Number(compensationEarnedBonus) || 0);
  const earnedOverride = employeeAllocations?.['Earned Leave'];
  const earnedTotal =
    earnedOverride !== undefined && earnedOverride !== null && !Number.isNaN(Number(earnedOverride))
      ? Math.max(0, Number(earnedOverride))
      : calculateEarnedLeaveAllocation(joinedAt, refDate);

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
    'Compensation Leave': bonus,
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

const CASUAL_SICK_TYPES = new Set(['Casual Leave', 'Sick Leave']);

/** Number of elapsed calendar months from join (or Jan) through current month, inclusive. */
export function monthsWorkedInCurrentYear(joinedAt?: string, refDate = new Date()): number {
  const y = refDate.getFullYear();
  const currentMonthIdx = refDate.getMonth();

  let startMonth = 0;

  if (joinedAt && joinedAt.trim()) {
    const join = new Date(`${joinedAt.trim()}T12:00:00Z`);
    if (Number.isNaN(join.getTime())) return 0;
    const joinYear = join.getFullYear();
    if (joinYear > y) return 0;
    if (joinYear === y) {
      startMonth = join.getMonth();
    }
  }

  return Math.max(0, currentMonthIdx - startMonth + 1);
}

/** Earned Leave accrues monthly (0.5 day/month) and resets each calendar year. */
export function calculateEarnedLeaveAllocation(joinedAt?: string, refDate = new Date()): number {
  return monthsWorkedInCurrentYear(joinedAt, refDate) * EARNED_LEAVE_ACCRUAL_PER_MONTH;
}

function paidCasualDays(leave: LeaveRequest): number {
  const lop = Number(leave.lopDays ?? 0) || 0;
  return Math.max(0, leave.days - lop);
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
  const calendarMonth = currentLeaveMonthKey(refDate);
  const calendarYear = String(refDate.getFullYear());
  const isYearlyType = type === 'Earned Leave' || type === 'Compensation Leave';

  return employeeLeaves.reduce((sum, leave) => {
    if (leave.status !== 'Pending') return sum;
    if (leave.type !== type) return sum;
    if (excludeLeaveId && leave.id === excludeLeaveId) return sum;
    if (typeof leave.from !== 'string' || leave.from.length < 7) return sum;
    if (isYearlyType) {
      if (leaveYear(leave.from) !== calendarYear) return sum;
    } else if (leaveMonth(leave.from) !== calendarMonth) {
      return sum;
    }
    return sum + leave.days;
  }, 0);
}

/** How much casual credit is already consumed this month (paid days only). */
export function casualCreditUsedThisMonth(
  employeeLeaves: LeaveRequest[],
  refDate = new Date(),
  excludeLeaveId?: string,
): number {
  const calendarMonth = currentLeaveMonthKey(refDate);
  return employeeLeaves.reduce((sum, leave) => {
    if (leave.type !== 'Casual Leave') return sum;
    if (leave.status !== 'Approved' && leave.status !== 'Pending') return sum;
    if (excludeLeaveId && leave.id === excludeLeaveId) return sum;
    if (!isLeaveInCurrentMonth(leave, calendarMonth)) return sum;
    if (leave.status === 'Approved') {
      return sum + paidCasualDays(leave);
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
): { paidDays: number; lopDays: number } {
  const refDate = options?.refDate ?? new Date();
  const totals = resolveLeaveAllocationTotals(
    options?.employeeAllocations,
    joinedAt,
    refDate,
    Number(options?.compensationEarnedBonus ?? 0) || 0,
  );
  const casualTotal = totals['Casual Leave'];
  const consumed = casualCreditUsedThisMonth(employeeLeaves, refDate, excludeLeaveId);
  const remaining = Math.max(0, casualTotal - consumed);
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
    if (leave.type !== 'Casual Leave') continue;
    if (!isLeaveInCurrentMonth(leave, calendarMonth)) continue;

    if (leave.status === 'Approved') {
      approvedLopDays += Number(leave.lopDays ?? 0) || 0;
      continue;
    }

    if (leave.status === 'Pending') {
      const stored = Number(leave.lopDays ?? NaN);
      if (!Number.isNaN(stored)) {
        pendingLopDays += stored;
      } else {
        const { lopDays } = computeCasualLeaveLopForRequest(
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

  return {
    approvedLopDays,
    pendingLopDays,
    totalLopDays: approvedLopDays + pendingLopDays,
  };
}

// Calculates total business days excluding weekends and provided holidays
export function getBusinessDays(from: string, to: string, holidays: Holiday[]): number {
  const start = new Date(from);
  const end = new Date(to);
  let count = 0;

  const holidayStrings = holidays.map((h) => h.date);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const dateString = d.toISOString().split('T')[0];

    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayStrings.includes(dateString)) {
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
  const compensationBonus = Number(options?.compensationEarnedBonus ?? 0) || 0;
  const totals = resolveLeaveAllocationTotals(
    options?.employeeAllocations,
    joinedAt,
    refDate,
    compensationBonus,
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
  const calendarMonth = currentLeaveMonthKey(refDate);

  employeeLeaves.forEach((leave) => {
    if (leave.status !== 'Approved' || typeof leave.from !== 'string' || leave.from.length < 7) {
      return;
    }

    const balanceKey = resolveLeaveBalanceKey(leave.type);
    const isYearlyType = balanceKey === 'Earned Leave' || balanceKey === 'Compensation Leave';
    if (isYearlyType) {
      if (leaveYear(leave.from) !== calendarYear) return;
    } else if (CASUAL_SICK_TYPES.has(leave.type)) {
      if (leaveMonth(leave.from) !== calendarMonth) return;
    } else if (leaveYear(leave.from) !== calendarYear) {
      return;
    }

    const debitDays =
      leave.type === 'Casual Leave' ? paidCasualDays(leave) : leave.days;

    if (balances[balanceKey]) {
      balances[balanceKey].used += debitDays;
      balances[balanceKey].remaining -= debitDays;
    } else {
      balances[balanceKey] = { total: 0, used: debitDays, remaining: -debitDays };
    }
  });

  for (const key of Object.keys(balances)) {
    balances[key].remaining = Math.max(0, balances[key].remaining);
  }

  return balances;
}
