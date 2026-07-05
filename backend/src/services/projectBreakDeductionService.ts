import type { Timesheet } from '../models/Timesheet';
import { computeSessionWorkedMs, type WorkDayType } from './workingTimeService';
import { type WorkBreakType } from '../utils/workBreaks';

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
  | 'loginTime'
  | 'logoutTime'
  | 'totalPausedMs'
  | 'overriddenHours'
  | 'totalHours'
  | 'workedMs'
  | 'breakMs'
  | 'taskStatus'
>;

/** Close open timesheets on checkout. Sets workedMs = end − start − breaks (see computeSessionWorkedMs). */
export function finalizeOpenTimesheetsForCheckout<T extends CheckoutTimesheet>(
  attendance: AttendanceBreakSnapshot,
  openLogs: T[],
  checkoutTime: Date,
  options?: {
    incompleteTaskStatus?: boolean;
    workDayType?: WorkDayType;
    /** 50 min default slice when full day + no breaks taken today (from daily budget). */
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

  const workDayType = options?.workDayType ?? 'full_day';
  const { workedMs, breakMs, defaultDeductedMs } = computeSessionWorkedMs(
    attendance.checkInTime,
    checkoutTime,
    attendance,
    workDayType,
    options?.defaultBreakDeductionMs ?? 0,
  );
  const sessionNetHours = workedMs > 0 ? Math.round((workedMs / 3600000) * 100) / 100 : 0;

  openLogs[0].workedMs = workedMs;
  openLogs[0].breakMs = breakMs;
  openLogs[0].totalHours = sessionNetHours;
  openLogs[0].overriddenHours = undefined;

  for (let index = 1; index < openLogs.length; index += 1) {
    openLogs[index].totalHours = 0;
    openLogs[index].workedMs = 0;
    openLogs[index].breakMs = 0;
    openLogs[index].totalPausedMs = 0;
    openLogs[index].overriddenHours = undefined;
  }

  return openLogs;
}

