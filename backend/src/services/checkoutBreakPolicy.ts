import { getOrCreateDailyBreakState, remainingDailyBreakBudgetMs } from './dailyBreakStateService';
import {
  hasAnyDailyBreakRecordedForEmployee,
  hasDailyDefaultDeductionBeenApplied,
} from './dailyBreakPolicyService';
import { computeGrossAttendanceMs } from '../utils/workBreaks';

/** Session must be at least 5 hours (gross check-in → check-out) to apply the 60m default. */
export const MIN_SESSION_MS_FOR_DEFAULT_BREAK = 5 * 60 * 60 * 1000;

export function sessionQualifiesForDefaultBreak(
  checkInTime: Date,
  checkOutTime: Date,
): boolean {
  return computeGrossAttendanceMs(checkInTime, checkOutTime) >= MIN_SESSION_MS_FOR_DEFAULT_BREAK;
}

/**
 * Default 60m once per day when:
 * - no real breaks recorded today
 * - default not already applied today
 * - this checkout session is >= 5 hours (gross)
 */
export async function resolveDefaultCheckoutBreakDeduction(
  employeeId: string,
  date: string,
  checkInTime: Date,
  checkOutTime: Date,
): Promise<number> {
  if (!sessionQualifiesForDefaultBreak(checkInTime, checkOutTime)) return 0;
  if (await hasAnyDailyBreakRecordedForEmployee(employeeId, date)) return 0;
  if (await hasDailyDefaultDeductionBeenApplied(employeeId, date)) return 0;

  const daily = await getOrCreateDailyBreakState(employeeId, date);
  return remainingDailyBreakBudgetMs(daily);
}
