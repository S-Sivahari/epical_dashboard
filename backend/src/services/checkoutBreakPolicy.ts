import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';
import {
  getOrCreateDailyBreakState,
  mergeDailyBreakWithOpenSession,
  remainingDailyBreakBudgetMs,
  type DailyBreakFields,
} from './dailyBreakStateService';
import {
  computeGrossAttendanceMs,
  computeUnusedSlotDefaultMs,
} from '../utils/workBreaks';

/** Session must be at least 5 hours (gross check-in → check-out) to apply unused-slot defaults. */
export const MIN_SESSION_MS_FOR_DEFAULT_BREAK = 5 * 60 * 60 * 1000;

export function sessionQualifiesForDefaultBreak(
  checkInTime: Date,
  checkOutTime: Date,
): boolean {
  return computeGrossAttendanceMs(checkInTime, checkOutTime) >= MIN_SESSION_MS_FOR_DEFAULT_BREAK;
}

async function defaultAlreadyAppliedToday(employeeId: string, date: string): Promise<boolean> {
  const daily = await getOrCreateDailyBreakState(employeeId, date);
  if ((daily.projectBreakDeductedMs ?? 0) > 0) return true;

  const priorDefault = await EmployeeAttendanceModel.exists({
    employeeId,
    date,
    defaultBreakDeductedMs: { $gt: 0 },
  });
  return Boolean(priorDefault);
}

/**
 * Unused-slot defaults once per day when this checkout session is >= 5 hours (gross).
 *
 * Per slot: taken → actual duration counts elsewhere; untaken → that slot's default
 * (morning 10 / lunch 40 / evening 10) is returned here.
 * Examples:
 * - no breaks → 60m
 * - morning 10m taken → 40 + 10 = 50m unused defaults (total with actual = 60m)
 * - lunch 20m taken → 10 + 10 = 20m unused defaults (total with actual = 40m)
 */
export async function resolveDefaultCheckoutBreakDeduction(
  employeeId: string,
  date: string,
  checkInTime: Date,
  checkOutTime: Date,
  attendance?: DailyBreakFields | null,
): Promise<number> {
  if (!sessionQualifiesForDefaultBreak(checkInTime, checkOutTime)) return 0;
  if (await defaultAlreadyAppliedToday(employeeId, date)) return 0;

  const daily = await getOrCreateDailyBreakState(employeeId, date);
  const merged = mergeDailyBreakWithOpenSession(daily, attendance);
  const unusedDefaults = computeUnusedSlotDefaultMs(merged);
  if (unusedDefaults <= 0) return 0;

  return Math.min(unusedDefaults, remainingDailyBreakBudgetMs(daily));
}
