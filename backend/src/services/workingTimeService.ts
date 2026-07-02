import {
  anyScheduledBreakUsed,
  computeGrossAttendanceMs,
  computeUsedBreakMs,
  DAILY_STANDARD_BREAK_MS,
  WORK_BREAKS,
  type WorkBreakType,
} from '../utils/workBreaks';
import { formatDurationFromMs } from '../utils/durationFormat';

export type WorkDayType = 'half_day' | 'full_day';

type AttendanceBreakFields = {
  checkInTime: Date;
  checkOutTime?: Date | null;
  morningBreakAt?: Date | null;
  lunchBreakAt?: Date | null;
  eveningBreakAt?: Date | null;
  morningBreakMs?: number | null;
  lunchBreakMs?: number | null;
  eveningBreakMs?: number | null;
  activeBreakType?: WorkBreakType | null;
  activeBreakStartedAt?: Date | null;
  activeBreakEndsAt?: Date | null;
  workDayType?: WorkDayType | null;
};

/** Elapsed ms during an in-progress break (capped at slot max). Pauses working-time clocks. */
export function computeActiveBreakPauseMs(
  attendance?: Pick<AttendanceBreakFields, 'activeBreakType' | 'activeBreakStartedAt'> | null,
  now = new Date(),
): number {
  if (!attendance?.activeBreakType || !attendance.activeBreakStartedAt) return 0;
  const config = WORK_BREAKS[attendance.activeBreakType];
  const elapsed = now.getTime() - new Date(attendance.activeBreakStartedAt).getTime();
  return Math.min(Math.max(0, elapsed), config.durationMs);
}

/** Default break deduction on checkout — full day only, when no breaks were logged today. */
export function resolveCheckoutDefaultBreakMs(
  workDayType: WorkDayType,
  dailyBreakUsedMs: number,
  remainingDailyBudgetMs: number,
): number {
  if (workDayType !== 'full_day') return 0;
  if (dailyBreakUsedMs > 0) return 0;
  return Math.max(0, remainingDailyBudgetMs);
}

/**
 * Single source of truth:
 *   worked = end − start − breaks
 *   breaks = actual breaks taken, OR 50 min default (full day only, when no breaks taken)
 *   half day = actual breaks only, no default
 * Returns breakMs = actual breaks only (for admin Break column; default 50 is not shown there).
 */
export function computeSessionWorkedMs(
  checkInTime: Date,
  checkOutTime: Date,
  attendance: AttendanceBreakFields | null | undefined,
  workDayType: WorkDayType,
  defaultBreakDeductionMs = 0,
): { workedMs: number; breakMs: number } {
  const grossMs = computeGrossAttendanceMs(checkInTime, checkOutTime);
  const breakMs = computeUsedBreakMs(attendance ?? undefined, checkOutTime);
  let deductMs = breakMs;
  if (workDayType === 'full_day' && breakMs === 0) {
    deductMs += Math.max(0, defaultBreakDeductionMs);
  }
  return {
    workedMs: Math.max(0, grossMs - deductMs),
    breakMs,
  };
}

/** Working ms for a completed attendance session (check-in → check-out minus breaks). */
export function computeCompletedWorkingMs(
  attendance: AttendanceBreakFields,
  checkoutTime: Date,
  options?: {
    workDayType?: WorkDayType;
    defaultBreakDeductionMs?: number;
  },
): number {
  const workDayType = options?.workDayType ?? attendance.workDayType ?? 'full_day';
  const defaultMs =
    workDayType === 'full_day' ? Math.max(0, options?.defaultBreakDeductionMs ?? 0) : 0;

  return computeSessionWorkedMs(
    attendance.checkInTime,
    checkoutTime,
    attendance,
    workDayType,
    defaultMs,
  ).workedMs;
}

/** Live working ms for an open attendance session (subtracts task pauses + active break). */
export function computeLiveWorkingMs(
  attendance: AttendanceBreakFields,
  options?: {
    taskPausedMs?: number;
    taskCurrentlyPaused?: boolean;
    now?: Date;
  },
): number {
  const now = options?.now ?? new Date();
  const grossMs = computeGrossAttendanceMs(attendance.checkInTime, attendance.checkOutTime, now);
  const taskPausedMs = Math.max(0, options?.taskPausedMs ?? 0);

  let breakPauseMs = 0;
  if (!options?.taskCurrentlyPaused) {
    breakPauseMs = computeActiveBreakPauseMs(attendance, now);
  }

  return Math.max(0, grossMs - taskPausedMs - breakPauseMs);
}

export function workingMsToDecimalHours(ms: number): number {
  if (ms <= 0) return 0;
  return Math.round((ms / 3600000) * 100) / 100;
}

/** Format ms for admin/employee duration labels (floor minutes, no 0.1h rounding drift). */
export function formatWorkedMsLabel(ms: number): string {
  return formatDurationFromMs(Math.max(0, ms));
}

/**
 * Read worked ms for display. Checked-out sessions use the value saved at checkout.
 */
export function resolveSessionWorkedMs(
  attendance: AttendanceBreakFields & {
    sessionWorkedMs?: number | null;
    autoCheckedOut?: boolean;
  },
  now = new Date(),
): number {
  if (typeof attendance.sessionWorkedMs === 'number' && attendance.sessionWorkedMs >= 0) {
    return attendance.sessionWorkedMs;
  }
  if (!attendance.checkOutTime) {
    return computeLiveWorkingMs(attendance, { now });
  }
  const workDayType: WorkDayType =
    attendance.workDayType === 'half_day'
      ? 'half_day'
      : attendance.autoCheckedOut
        ? 'full_day'
        : attendance.workDayType === 'full_day'
          ? 'full_day'
          : 'full_day';
  return computeSessionWorkedMs(
    attendance.checkInTime,
    new Date(attendance.checkOutTime),
    attendance,
    workDayType,
    0,
  ).workedMs;
}

export function computeWorkingHours(
  attendance: AttendanceBreakFields,
  options?: {
    now?: Date;
    workDayType?: WorkDayType;
    defaultBreakDeductionMs?: number;
    taskPausedMs?: number;
    taskCurrentlyPaused?: boolean;
  },
): number {
  const now = options?.now ?? new Date();
  const ms = attendance.checkOutTime
    ? resolveSessionWorkedMs(attendance, now)
    : computeLiveWorkingMs(attendance, {
        taskPausedMs: options?.taskPausedMs,
        taskCurrentlyPaused: options?.taskCurrentlyPaused,
        now,
      });
  return workingMsToDecimalHours(ms);
}

export { anyScheduledBreakUsed, computeUsedBreakMs, DAILY_STANDARD_BREAK_MS };
