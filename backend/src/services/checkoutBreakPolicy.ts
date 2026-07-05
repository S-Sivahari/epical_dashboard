import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';
import { DAILY_STANDARD_BREAK_MS } from '../utils/workBreaks';
import { getOrCreateDailyBreakState, remainingDailyBreakBudgetMs } from './dailyBreakStateService';

/** Default 50m slice for a full-day checkout with no breaks in this session. */
export async function resolveDefaultCheckoutBreakDeduction(
  employeeId: string,
  date: string,
  sessionBreakMs: number,
): Promise<number> {
  if (sessionBreakMs > 0) return 0;

  const priorDefault = await EmployeeAttendanceModel.exists({
    employeeId,
    date,
    defaultBreakDeductedMs: { $gt: 0 },
  });
  if (priorDefault) return 0;

  const daily = await getOrCreateDailyBreakState(employeeId, date);
  return remainingDailyBreakBudgetMs(daily);
}

export function isFullDayCheckoutTooShort(
  grossMs: number,
  sessionBreakMs: number,
  defaultBreakDeductionMs: number,
): boolean {
  if (sessionBreakMs > 0) return false;
  if (defaultBreakDeductionMs <= 0) return false;
  return grossMs < DAILY_STANDARD_BREAK_MS;
}

export const FULL_DAY_TOO_SHORT_MESSAGE =
  'This session is shorter than the standard break deduction (50 minutes). Please select Half day checkout instead.';
