import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';
import { TimesheetModel } from '../models/Timesheet';
import {
  anyScheduledBreakUsed,
  computeUsedBreakMs,
  DAILY_STANDARD_BREAK_MS,
} from '../utils/workBreaks';
import { getSchedulerDateKey } from '../utils/istClock';
import {
  applyDailyCappedBreakDeduction,
  getOrCreateDailyBreakState,
} from './dailyBreakStateService';
import { applySessionWorkedToTimesheetLogs } from './projectBreakDeductionService';
import { computeSessionWorkedMs } from './workingTimeService';
import { sessionQualifiesForDefaultBreak } from './checkoutBreakPolicy';

export async function hasAnyDailyBreakRecordedForEmployee(
  employeeId: string,
  date: string,
): Promise<boolean> {
  const daily = await getOrCreateDailyBreakState(employeeId, date);
  if (anyScheduledBreakUsed(daily)) return true;

  const count = await EmployeeAttendanceModel.countDocuments({
    employeeId,
    date,
    $or: [
      { morningBreakAt: { $exists: true, $ne: null } },
      { lunchBreakAt: { $exists: true, $ne: null } },
      { eveningBreakAt: { $exists: true, $ne: null } },
    ],
  });
  return count > 0;
}

export async function hasDailyDefaultDeductionBeenApplied(
  employeeId: string,
  date: string,
): Promise<boolean> {
  const daily = await getOrCreateDailyBreakState(employeeId, date);
  if ((daily.projectBreakDeductedMs ?? 0) > 0) return true;

  const priorDefault = await EmployeeAttendanceModel.exists({
    employeeId,
    date,
    defaultBreakDeductedMs: { $gt: 0 },
  });
  return Boolean(priorDefault);
}

async function updateTimesheetsForAttendanceSession(
  attendance: InstanceType<typeof EmployeeAttendanceModel>,
  workedMs: number,
  breakMs: number,
): Promise<void> {
  if (!attendance.checkOutTime) return;

  const checkInTime = attendance.checkInTime;
  const checkOutTime = attendance.checkOutTime;

  const logs = await TimesheetModel.find({
    loginTime: { $gte: checkInTime, $lte: checkOutTime },
    $or: [
      { logoutTime: { $gte: checkInTime } },
      { logoutTime: { $exists: false } },
      { logoutTime: null },
    ],
  }).sort({ loginTime: 1 });

  if (logs.length === 0) return;

  const updated = applySessionWorkedToTimesheetLogs(logs, workedMs, breakMs);
  for (const log of updated) {
    await log.save();
  }
}

/**
 * Convert today's half-day attendance rows to full-day and apply the daily break policy.
 * Past dates are never modified.
 */
export async function normalizeTodaysHalfDaySessions(employeeId: string): Promise<void> {
  const today = getSchedulerDateKey(new Date());
  const halfDayRecords = await EmployeeAttendanceModel.find({
    employeeId,
    date: today,
    workDayType: 'half_day',
  }).sort({ checkInTime: 1 });

  if (halfDayRecords.length === 0) return;

  const allToday = await EmployeeAttendanceModel.find({ employeeId, date: today }).sort({
    checkInTime: 1,
  });

  let defaultAlreadyApplied = await hasDailyDefaultDeductionBeenApplied(employeeId, today);
  let anyBreakUsed = await hasAnyDailyBreakRecordedForEmployee(employeeId, today);

  for (const record of allToday) {
    const wasHalfDay = record.workDayType === 'half_day';
    if (wasHalfDay) {
      record.workDayType = 'full_day';
    }

    if (!record.checkOutTime) {
      if (wasHalfDay) await record.save();
      continue;
    }

    if (!wasHalfDay) {
      if ((record.defaultBreakDeductedMs ?? 0) > 0) defaultAlreadyApplied = true;
      if (computeUsedBreakMs(record, record.checkOutTime) > 0) anyBreakUsed = true;
      continue;
    }

    const sessionBreakMs = computeUsedBreakMs(record, record.checkOutTime);
    let defaultDeduction = 0;

    if (
      !anyBreakUsed &&
      !defaultAlreadyApplied &&
      sessionQualifiesForDefaultBreak(record.checkInTime, record.checkOutTime)
    ) {
      defaultDeduction = DAILY_STANDARD_BREAK_MS;
      defaultAlreadyApplied = true;
    }

    const preview = computeSessionWorkedMs(
      record.checkInTime,
      record.checkOutTime,
      record,
      'full_day',
      defaultDeduction,
    );

    record.sessionWorkedMs = preview.workedMs;
    record.defaultBreakDeductedMs = preview.defaultDeductedMs;
    await record.save();

    if (defaultDeduction > 0) {
      await applyDailyCappedBreakDeduction(employeeId, today, defaultDeduction);
    }

    if (sessionBreakMs > 0) anyBreakUsed = true;

    await updateTimesheetsForAttendanceSession(record, preview.workedMs, preview.breakMs);
  }
}

/** Apply the 60m daily default to today's first qualifying checkout when missing. */
export async function reconcileTodaysDefaultDeductions(employeeId: string): Promise<void> {
  const today = getSchedulerDateKey(new Date());
  if (await hasAnyDailyBreakRecordedForEmployee(employeeId, today)) return;
  if (await hasDailyDefaultDeductionBeenApplied(employeeId, today)) return;

  const firstSession = await EmployeeAttendanceModel.findOne({
    employeeId,
    date: today,
    checkOutTime: { $exists: true, $ne: null },
  }).sort({ checkInTime: 1 });

  if (!firstSession?.checkOutTime) return;
  if (!sessionQualifiesForDefaultBreak(firstSession.checkInTime, firstSession.checkOutTime)) {
    return;
  }

  firstSession.workDayType = 'full_day';
  const preview = computeSessionWorkedMs(
    firstSession.checkInTime,
    firstSession.checkOutTime,
    firstSession,
    'full_day',
    DAILY_STANDARD_BREAK_MS,
  );

  firstSession.defaultBreakDeductedMs = preview.defaultDeductedMs;
  firstSession.sessionWorkedMs = preview.workedMs;
  await firstSession.save();
  await applyDailyCappedBreakDeduction(employeeId, today, DAILY_STANDARD_BREAK_MS);
  await updateTimesheetsForAttendanceSession(firstSession, preview.workedMs, preview.breakMs);
}

export async function syncTodaysAttendanceBreakPolicy(employeeId: string): Promise<void> {
  await normalizeTodaysHalfDaySessions(employeeId);
  await reconcileTodaysDefaultDeductions(employeeId);
}
