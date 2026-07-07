import { getOrCreateDailyBreakState, remainingDailyBreakBudgetMs } from './dailyBreakStateService';
import {
  hasAnyDailyBreakRecordedForEmployee,
  hasDailyDefaultDeductionBeenApplied,
} from './dailyBreakPolicyService';

/** Default 60m for the first checkout of the day when no daily breaks were recorded. */
export async function resolveDefaultCheckoutBreakDeduction(
  employeeId: string,
  date: string,
): Promise<number> {
  if (await hasAnyDailyBreakRecordedForEmployee(employeeId, date)) return 0;
  if (await hasDailyDefaultDeductionBeenApplied(employeeId, date)) return 0;

  const daily = await getOrCreateDailyBreakState(employeeId, date);
  return remainingDailyBreakBudgetMs(daily);
}
