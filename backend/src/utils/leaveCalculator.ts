import { Holiday } from '../models/Holiday';
import { LeaveRequest } from '../models/Leave';

export const LEAVE_ALLOCATIONS = {
  'Casual Leave': 12,
  'Sick Leave': 12,
};

/** Calendar year suffix for yyyy-MM-dd id strings */
export function leaveYear(dateStr: string): string {
  return dateStr.slice(0, 4);
}

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
    /** Defaults to today; useful for reports. */
    refDate?: Date;
  },
) {
  const refDate = options?.refDate ?? new Date();
  const compensationBonus = Number(options?.compensationEarnedBonus ?? 0) || 0;
  const earnedAlloc =
    calculateEarnedLeaveAllocation(joinedAt, refDate) + Math.max(0, compensationBonus);

  const balances: Record<string, { total: number; used: number; remaining: number }> = {
    'Casual Leave': { total: LEAVE_ALLOCATIONS['Casual Leave'], used: 0, remaining: LEAVE_ALLOCATIONS['Casual Leave'] },
    'Sick Leave': { total: LEAVE_ALLOCATIONS['Sick Leave'], used: 0, remaining: LEAVE_ALLOCATIONS['Sick Leave'] },
    'Earned Leave': { total: earnedAlloc, used: 0, remaining: earnedAlloc },
  };

  const calendarYear = String(refDate.getFullYear());

  employeeLeaves.forEach((leave) => {
    // Year reset: usage only counts leaves whose period starts in the current calendar year
    // (annual allocation for casual/sick is fixed per calendar year in this model).
    const leaveStartsInYear =
      typeof leave.from === 'string' && leave.from.length >= 4 && leaveYear(leave.from) === calendarYear;
    if (!leaveStartsInYear) return;

    if (leave.status === 'Approved') {
      if (balances[leave.type]) {
        balances[leave.type].used += leave.days;
        balances[leave.type].remaining -= leave.days;
      } else {
        balances[leave.type] = { total: 0, used: leave.days, remaining: -leave.days };
      }
    }
  });

  return balances;
}
