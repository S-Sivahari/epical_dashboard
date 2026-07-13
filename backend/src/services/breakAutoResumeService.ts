import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';
import { openAttendanceFilter, resolveIdentityTokensForAttendance } from '../utils/attendanceQueries';
import { activeBreakExpired, recordCompletedBreakDuration, type WorkBreakType } from '../utils/workBreaks';
import {
  applyDailyCappedBreakDeduction,
  markDailyBreakSlotCompleted,
} from './dailyBreakStateService';
import { resumeBreakPausedTask } from './timesheetBreakService';
import { resumeProductiveSessionsForEmployee } from './productiveTimeService';

type AttendanceDoc = InstanceType<typeof EmployeeAttendanceModel>;

async function resolveTokensForAttendance(attendance: AttendanceDoc): Promise<string[]> {
  return resolveIdentityTokensForAttendance({
    employeeId: attendance.employeeId,
    employeeName: attendance.employeeName,
    employeeEmail: attendance.employeeEmail,
  });
}

/**
 * End an active break, apply project-hour deduction, and resume the paused task.
 */
export async function finalizeBreakEnd(
  attendance: AttendanceDoc,
  breakType: WorkBreakType,
  endedAt: Date,
  timesheetId?: string,
): Promise<number> {
  const identityTokens = await resolveTokensForAttendance(attendance);
  const breakMs = recordCompletedBreakDuration(attendance, breakType, endedAt);
  await markDailyBreakSlotCompleted(
    attendance.employeeId,
    attendance.date,
    breakType,
    endedAt,
    breakMs,
  );
  const appliedMs = await applyDailyCappedBreakDeduction(
    attendance.employeeId,
    attendance.date,
    breakMs,
  );
  await resumeBreakPausedTask(timesheetId, identityTokens, appliedMs);

  void resumeProductiveSessionsForEmployee(identityTokens, undefined, endedAt).catch((err) =>
    console.error('[break-auto-resume] cell resume sync failed:', err),
  );

  return appliedMs;
}

/** Auto-end a break when its configured duration has elapsed. */
export async function expireBreakForAttendanceRecord(
  attendance: AttendanceDoc,
  now = new Date(),
): Promise<boolean> {
  if (!attendance.activeBreakType || !attendance.activeBreakEndsAt) return false;
  if (!activeBreakExpired(attendance, now)) return false;

  const claimed = await EmployeeAttendanceModel.findOneAndUpdate(
    {
      _id: attendance._id,
      activeBreakType: attendance.activeBreakType,
      activeBreakEndsAt: { $lte: now },
    },
    {
      $unset: {
        activeBreakType: '',
        activeBreakStartedAt: '',
        activeBreakEndsAt: '',
        breakPausedTimesheetId: '',
      },
    },
    { new: false },
  );

  if (!claimed?.activeBreakType || !claimed.activeBreakEndsAt) return false;

  const breakType = claimed.activeBreakType;
  const endedAt = claimed.activeBreakEndsAt;
  const timesheetId = claimed.breakPausedTimesheetId;

  const breakMs = recordCompletedBreakDuration(claimed, breakType, endedAt);
  await EmployeeAttendanceModel.updateOne(
    { _id: claimed._id },
    {
      $set: {
        morningBreakMs: claimed.morningBreakMs,
        lunchBreakMs: claimed.lunchBreakMs,
        eveningBreakMs: claimed.eveningBreakMs,
      },
    },
  );

  await markDailyBreakSlotCompleted(
    claimed.employeeId,
    claimed.date,
    breakType,
    endedAt,
    breakMs,
  );
  const identityTokens = await resolveTokensForAttendance(claimed);
  const appliedMs = await applyDailyCappedBreakDeduction(claimed.employeeId, claimed.date, breakMs);
  await resumeBreakPausedTask(timesheetId ?? undefined, identityTokens, appliedMs);

  void resumeProductiveSessionsForEmployee(identityTokens, undefined, endedAt).catch((err) =>
    console.error('[break-auto-resume] cell resume sync failed:', err),
  );

  console.log(
    `[break-auto-resume] Expired ${breakType} break for employee ${claimed.employeeId} (${claimed.employeeName})`,
  );

  return true;
}

export async function tryExpireBreakForEmployee(employeeId: string, now = new Date()): Promise<boolean> {
  const attendance = await EmployeeAttendanceModel.findOne(
    openAttendanceFilter({ employeeId }),
  ).sort({ checkInTime: -1 });

  if (!attendance) return false;
  return expireBreakForAttendanceRecord(attendance, now);
}

/** Sweep all open sessions with expired breaks (runs on a schedule). */
export async function processExpiredBreaks(now = new Date()): Promise<number> {
  const candidates = await EmployeeAttendanceModel.find(
    openAttendanceFilter({
      activeBreakType: { $in: ['morning', 'lunch', 'evening'] },
      activeBreakEndsAt: { $lte: now },
    }),
  );

  let count = 0;
  for (const attendance of candidates) {
    try {
      const expired = await expireBreakForAttendanceRecord(attendance, now);
      if (expired) count += 1;
    } catch (error) {
      console.error(
        `[break-auto-resume] Failed for attendance ${attendance._id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (count > 0) {
    console.log(`[break-auto-resume] Auto-resumed ${count} expired break(s)`);
  }

  return count;
}
