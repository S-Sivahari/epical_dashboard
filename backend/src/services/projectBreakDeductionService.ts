import type { Types } from 'mongoose';
import type { Timesheet } from '../models/Timesheet';
import { TimesheetModel } from '../models/Timesheet';
import { computeWorkedMs } from '../utils/durationFormat';
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
  | 'projectId'
  | 'project'
  | 'loginTime'
  | 'logoutTime'
  | 'totalPausedMs'
  | 'overriddenHours'
  | 'totalHours'
  | 'workedMs'
  | 'breakMs'
  | 'taskStatus'
>;

function taskGrossMs(log: CheckoutTimesheet): number {
  if (!log.loginTime || !log.logoutTime) return 0;
  return computeWorkedMs(
    new Date(log.loginTime),
    new Date(log.logoutTime),
    log.totalPausedMs || 0,
  );
}

function projectKey(log: CheckoutTimesheet): string {
  return log.projectId ? String(log.projectId) : String(log.project || '').trim();
}

/**
 * Credit session net worked time to project task logs.
 * One project in the session → full session worked on that project's latest task.
 */
export function applySessionWorkedToTimesheetLogs<T extends CheckoutTimesheet>(
  logs: T[],
  sessionWorkedMs: number,
  breakMs: number,
): T[] {
  const sorted = [...logs].sort(
    (a, b) => new Date(a.loginTime!).getTime() - new Date(b.loginTime!).getTime(),
  );

  if (sorted.length === 0) return sorted;

  for (const log of sorted) {
    log.workedMs = 0;
    log.breakMs = 0;
    log.totalHours = 0;
    log.overriddenHours = undefined;
  }

  const projectGroups = new Map<string, T[]>();
  const projectGross = new Map<string, number>();

  for (const log of sorted) {
    const key = projectKey(log);
    const group = projectGroups.get(key);
    if (group) {
      group.push(log);
    } else {
      projectGroups.set(key, [log]);
    }
    projectGross.set(key, (projectGross.get(key) || 0) + taskGrossMs(log));
  }

  const projectKeys = [...projectGroups.keys()];
  const totalGross = [...projectGross.values()].reduce((sum, gross) => sum + gross, 0);
  let assigned = 0;

  for (let index = 0; index < projectKeys.length; index += 1) {
    const key = projectKeys[index];
    const isLast = index === projectKeys.length - 1;
    const gross = projectGross.get(key) || 0;

    let share = 0;
    if (sessionWorkedMs > 0) {
      if (projectKeys.length === 1) {
        share = sessionWorkedMs;
      } else if (totalGross > 0) {
        share = isLast
          ? Math.max(0, sessionWorkedMs - assigned)
          : Math.floor((sessionWorkedMs * gross) / totalGross);
        if (!isLast) assigned += share;
      }
    }

    const projectLogs = projectGroups.get(key) || [];
    const targetLog = projectLogs[projectLogs.length - 1];
    targetLog.workedMs = share;
    targetLog.breakMs = index === 0 ? breakMs : 0;
    targetLog.totalHours = share > 0 ? Math.round((share / 3600000) * 100) / 100 : 0;
  }

  return sorted;
}

export async function findTimesheetLogsForAttendanceSession(
  identityTokens: string[],
  checkInTime: Date,
  checkOutTime: Date,
): Promise<InstanceType<typeof TimesheetModel>[]> {
  return TimesheetModel.find({
    $and: [
      {
        $or: [
          { employeeId: { $in: identityTokens } },
          { employee: { $in: identityTokens } },
        ],
      },
      { loginTime: { $gte: checkInTime, $lte: checkOutTime } },
      {
        $or: [
          { logoutTime: { $gte: checkInTime } },
          { logoutTime: { $exists: false } },
          { logoutTime: null },
        ],
      },
    ],
  }).sort({ loginTime: 1 });
}

function mergeOpenLogUpdates<T extends CheckoutTimesheet & { _id: Types.ObjectId }>(
  sessionLogs: T[],
  openLogs: T[],
): T[] {
  const openById = new Map(openLogs.map((log) => [log._id.toString(), log]));
  return sessionLogs.map((log) => openById.get(log._id.toString()) ?? log);
}

/** Close open timesheets on checkout and store session worked time on the session's project log(s). */
export async function finalizeOpenTimesheetsForCheckout<
  T extends CheckoutTimesheet & { _id: Types.ObjectId },
>(
  attendance: AttendanceBreakSnapshot,
  openLogs: T[],
  checkoutTime: Date,
  identityTokens: string[],
  options?: {
    incompleteTaskStatus?: boolean;
    workDayType?: WorkDayType;
    /** Unused-slot defaults toward the 1h daily limit when session qualifies (>= 5h). */
    defaultBreakDeductionMs?: number;
  },
): Promise<T[]> {
  for (const log of openLogs) {
    log.logoutTime = checkoutTime;
    log.totalPausedMs = 0;

    if (['In Progress', 'Paused', 'Session Incomplete'].includes(log.taskStatus || '')) {
      log.taskStatus = options?.incompleteTaskStatus ? 'Session Incomplete' : 'Pending';
    }
  }

  const workDayType = options?.workDayType ?? 'full_day';
  const { workedMs, breakMs } = computeSessionWorkedMs(
    attendance.checkInTime,
    checkoutTime,
    attendance,
    workDayType,
    options?.defaultBreakDeductionMs ?? 0,
  );

  if (openLogs.length === 0) {
    return [];
  }

  const sessionLogs = await findTimesheetLogsForAttendanceSession(
    identityTokens,
    attendance.checkInTime,
    checkoutTime,
  );
  const mergedLogs = mergeOpenLogUpdates(sessionLogs as T[], openLogs);
  return applySessionWorkedToTimesheetLogs(mergedLogs, workedMs, breakMs);
}
