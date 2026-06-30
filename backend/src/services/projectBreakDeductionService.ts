import type { Timesheet } from '../models/Timesheet';
import { computeProjectSessionWorkedMs, type WorkBreakType } from '../utils/workBreaks';

type AttendanceBreakSnapshot = {
  checkInTime: Date;
  morningBreakAt?: Date | null;
  lunchBreakAt?: Date | null;
  eveningBreakAt?: Date | null;
  morningBreakMs?: number | null;
  lunchBreakMs?: number | null;
  eveningBreakMs?: number | null;
  activeBreakType?: WorkBreakType | null;
  activeBreakStartedAt?: Date | null;
  activeBreakEndsAt?: Date | null;
};

type CheckoutTimesheet = Pick<
  Timesheet,
  'loginTime' | 'logoutTime' | 'totalPausedMs' | 'overriddenHours' | 'totalHours' | 'taskStatus'
>;

/**
 * Close open timesheets on checkout/auto-checkout.
 * Project hours = check-in → check-out minus breaks (credited to the active project row).
 */
export function finalizeOpenTimesheetsForCheckout<T extends CheckoutTimesheet>(
  attendance: AttendanceBreakSnapshot,
  openLogs: T[],
  checkoutTime: Date,
  options?: {
    incompleteTaskStatus?: boolean;
    /** Default break deduction when no breaks were logged today (max 50 min/day). */
    defaultBreakDeductionMs?: number;
  },
): T[] {
  for (const log of openLogs) {
    log.logoutTime = checkoutTime;
    log.totalPausedMs = 0;

    if (['In Progress', 'Paused', 'Session Incomplete'].includes(log.taskStatus || '')) {
      log.taskStatus = options?.incompleteTaskStatus ? 'Session Incomplete' : 'Pending';
    }
  }

  if (openLogs.length === 0) {
    return [];
  }

  const sessionNetMs = computeProjectSessionWorkedMs(
    attendance.checkInTime,
    checkoutTime,
    attendance,
    options?.defaultBreakDeductionMs ?? 0,
  );
  const sessionNetHours = Math.round((sessionNetMs / 3600000) * 10) / 10;

  openLogs[0].totalHours = sessionNetHours;
  openLogs[0].overriddenHours = undefined;

  for (let index = 1; index < openLogs.length; index += 1) {
    openLogs[index].totalHours = 0;
    openLogs[index].totalPausedMs = 0;
    openLogs[index].overriddenHours = undefined;
  }

  return openLogs;
}
