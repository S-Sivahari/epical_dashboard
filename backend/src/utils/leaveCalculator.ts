import { Holiday } from '../models/Holiday';
import { LeaveRequest } from '../models/Leave';

export const LEAVE_ALLOCATIONS = {
  'Casual Leave': 12,
  'Sick Leave': 12,
};

export type LeaveAllocationType = 'Casual Leave' | 'Sick Leave' | 'Earned Leave';

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
      : calculateEarnedLeaveAllocation(joinedAt, refDate) + bonus;

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

function currentLeaveMonthKey(refDate = new Date()): string {
  const y = refDate.getFullYear();
  const m = String(refDate.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

const CASUAL_SICK_TYPES = new Set(['Casual Leave', 'Sick Leave']);

/** Number of elapsed calendar months from join (or Jan) through current month, inclusive — used for Earned Leave accrual (0.5 day per month worked). */
export function monthsWorkedInCurrentYear(joinedAt?: string, refDate = new Date()): number {
  const y = refDate.getFullYear();
  const currentMonthIdx = refDate.getMonth(); // 0-based

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

/** Earned Leave is 0 by default. It only increases via compensation. */
export function calculateEarnedLeaveAllocation(joinedAt?: string, refDate = new Date()): number {
  return 0;
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

    // 0 is Sunday, 6 is Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayStrings.includes(dateString)) {
      count++;
    }
  }

  return count;
}

export function calculateBalances(
  employeeLeaves: LeaveRequest[],
  joinedAt?: string,
  options?: {
    /** Extra Earned Leave days granted via approved compensation entries (same calendar year as balances). */
    compensationEarnedBonus?: number;
    /** Admin-defined per-employee allotment overrides. */
    employeeAllocations?: Partial<Record<string, number>>;
    /** Defaults to today; useful for reports. */
    refDate?: Date;
  },
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
  };

  const calendarYear = String(refDate.getFullYear());
  const calendarMonth = currentLeaveMonthKey(refDate);

  employeeLeaves.forEach((leave) => {
    if (leave.status !== 'Approved' || typeof leave.from !== 'string' || leave.from.length < 7) {
      return;
    }

    const isEarned = leave.type === 'Earned Leave';
    // Casual & sick: current calendar month only (resets monthly). Earned: current calendar year only.
    if (isEarned) {
      if (leaveYear(leave.from) !== calendarYear) return;
    } else if (CASUAL_SICK_TYPES.has(leave.type)) {
      if (leaveMonth(leave.from) !== calendarMonth) return;
    } else if (leaveYear(leave.from) !== calendarYear) {
      return;
    }

    if (balances[leave.type]) {
      balances[leave.type].used += leave.days;
      balances[leave.type].remaining -= leave.days;
    } else {
      balances[leave.type] = { total: 0, used: leave.days, remaining: -leave.days };
    }
  });

  return balances;
}
