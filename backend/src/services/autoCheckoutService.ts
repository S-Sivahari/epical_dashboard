import mongoose, { type ClientSession } from 'mongoose';
import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';
import { AutoCheckoutSettingsModel } from '../models/AutoCheckoutSettings';
import { TimesheetModel } from '../models/Timesheet';
import { AssignedTaskModel } from '../models/AssignedTask';
import { syncProjectForTimesheet } from '../utils/syncProject';
import {
  identityTokensFromAttendance,
  openAttendanceFilter,
  openTimesheetsForAttendanceFilter,
  resolveIdentityTokensForAttendance,
} from '../utils/attendanceQueries';
import {
  computeTotalHoursDecimal,
  formatDurationFromMs,
  sumTimesheetWorkedMs,
} from '../utils/durationFormat';
import { sendCheckoutReminderEmail, sendAutoCheckoutConfirmationEmail } from './emailService';
import { env } from '../config/env';
import {
  formatSchedulerDateTime,
  resolveSchedulerAutoCheckoutDeadline,
} from '../utils/istClock';
import {
  recordCompletedBreakDuration,
  activeBreakExpired,
} from '../utils/workBreaks';
import {
  applyDailyCappedBreakDeduction,
  markDailyBreakSlotCompleted,
  resolveDefaultCheckoutBreakDeduction,
} from './dailyBreakStateService';
import { finalizeOpenTimesheetsForCheckout } from './projectBreakDeductionService';
import { resumeBreakPausedTask } from './timesheetBreakService';
import {
  closeProductiveSessionsForEmployee,
  WORK_SESSION_REASONS,
} from './productiveTimeService';

function isTransactionUnsupportedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /replica set|mongos|Transaction numbers are only allowed/i.test(message);
}

function resolveAutoCheckoutDeadline(
  attendance: { checkInTime: Date },
  settings: { autoCheckoutTime: string },
): Date {
  return resolveSchedulerAutoCheckoutDeadline(attendance.checkInTime, settings.autoCheckoutTime);
}

function isAutoCheckoutDue(
  attendance: { checkInTime: Date; autoCheckoutTime?: Date | null },
  settings: { autoCheckoutTime: string },
  now: Date
): boolean {
  if (env.testCronTimings) {
    const elapsedMs = now.getTime() - attendance.checkInTime.getTime();
    return elapsedMs >= 5 * 60 * 1000;
  }

  const deadline = resolveAutoCheckoutDeadline(attendance, settings);
  return now.getTime() >= deadline.getTime() - 30_000;
}

async function findOpenTimesheetsForAutoCheckout(
  attendance: {
    employeeId?: string;
    employeeName?: string;
    employeeEmail?: string;
    checkInTime: Date;
  },
  session?: ClientSession
) {
  const identityTokens = await resolveIdentityTokensForAttendance(attendance);
  const checkInTime = attendance.checkInTime;

  const runQuery = (filter: ReturnType<typeof openTimesheetsForAttendanceFilter>) => {
    const query = TimesheetModel.find(filter);
    if (session) query.session(session);
    return query;
  };

  let openLogs = await runQuery(openTimesheetsForAttendanceFilter(identityTokens, checkInTime));

  if (openLogs.length === 0) {
    openLogs = await runQuery(
      openTimesheetsForAttendanceFilter(identityTokens, checkInTime, { strictLoginWindow: false })
    );
  }

  if (openLogs.length === 0) {
    const fallbackTokens = identityTokensFromAttendance(attendance);
    openLogs = await runQuery(
      openTimesheetsForAttendanceFilter(fallbackTokens, checkInTime, { strictLoginWindow: false })
    );
  }

  return { openLogs, identityTokens };
}

export async function getAutoCheckoutSettings() {
  let settings = await AutoCheckoutSettingsModel.findOne();
  if (!settings) {
    settings = await AutoCheckoutSettingsModel.create({
      reminderTime: env.DEFAULT_REMINDER_TIME,
      autoCheckoutTime: env.DEFAULT_AUTO_CHECKOUT_TIME,
      enabled: true,
    });
  } else if (settings.autoCheckoutTime === '00:00') {
    settings.autoCheckoutTime = env.DEFAULT_AUTO_CHECKOUT_TIME;
    await settings.save();
  }
  return settings;
}

export async function updateAutoCheckoutSettings(data: {
  reminderTime?: string;
  autoCheckoutTime?: string;
  enabled?: boolean;
}) {
  let settings = await AutoCheckoutSettingsModel.findOne();
  if (!settings) {
    settings = await AutoCheckoutSettingsModel.create({
      reminderTime: data.reminderTime || env.DEFAULT_REMINDER_TIME,
      autoCheckoutTime: data.autoCheckoutTime || env.DEFAULT_AUTO_CHECKOUT_TIME,
      enabled: data.enabled ?? true,
    });
  } else {
    if (data.reminderTime !== undefined) settings.reminderTime = data.reminderTime;
    if (data.autoCheckoutTime !== undefined) settings.autoCheckoutTime = data.autoCheckoutTime;
    if (data.enabled !== undefined) settings.enabled = data.enabled;
    await settings.save();
  }
  return settings;
}

export async function processReminders(): Promise<number> {
  const settings = await getAutoCheckoutSettings();
  if (!settings.enabled) {
    console.log('[Reminder Job] Disabled via auto-checkout settings.');
    return 0;
  }

  const query = openAttendanceFilter({
    reminderSent: false,
    autoCheckoutEnabled: true,
  });

  console.log(`[Reminder Job] Scanning for open sessions at ${new Date().toISOString()}`);
  const activeAttendances = await EmployeeAttendanceModel.find(query);

  console.log(`[Reminder Job] Open sessions found: ${activeAttendances.length}`);

  let sentCount = 0;
  const now = new Date();

  for (const attendance of activeAttendances) {
    const checkInTime = attendance.checkInTime;
    const elapsedMs = now.getTime() - checkInTime.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));

    const isEligible = env.testCronTimings ? elapsedMinutes >= 2 : true;

    console.log(
      `[Reminder Job] Session: ID=${attendance._id}, EmployeeID=${attendance.employeeId}, EmployeeName=${attendance.employeeName}, Status=${attendance.sessionStatus}, Check-in=${checkInTime.toISOString()}, ElapsedMinutes=${elapsedMinutes}, ReminderEligible=${isEligible}`
    );

    if (!isEligible) continue;

    const email = attendance.employeeEmail;
    if (!email) {
      console.log(
        `[Reminder Job] No email for employee ${attendance.employeeName} — marking reminder sent`
      );
      attendance.reminderSent = true;
      await attendance.save();
      continue;
    }

    const { openLogs } = await findOpenTimesheetsForAutoCheckout(attendance);
    const activeLog =
      openLogs.find((log) => log.taskStatus === 'In Progress' || log.taskStatus === 'Session Incomplete') ||
      openLogs[0];

    const activeDurationMs = activeLog
      ? sumTimesheetWorkedMs([activeLog], now)
      : Math.max(0, elapsedMs);

    console.log(`[Reminder Job] Sending reminder email to: ${email}`);
    const sent = await sendCheckoutReminderEmail({
      to: email,
      employeeName: attendance.employeeName,
      checkInTime: attendance.checkInTime,
      autoCheckoutTime: settings.autoCheckoutTime,
      projectName: activeLog?.project || 'No active project',
      activeDurationMs,
    });

    if (sent) {
      attendance.reminderSent = true;
      await attendance.save();
      console.log(`[Reminder Job] Reminder email sent successfully to ${email}`);
      sentCount++;
    } else {
      console.log(`[Reminder Job] Failed to send reminder email to ${email}. Will retry on next tick.`);
    }
  }

  console.log(`[Reminder Job] Completed. Sent: ${sentCount}`);
  return sentCount;
}

type AutoCheckoutResult = {
  checkedOut: boolean;
  totalDurationMs: number;
  projectName: string;
  workDescription?: string;
  checkOutTime: Date;
  checkInTime: Date;
  employeeEmail?: string;
  employeeName: string;
  closedLogCount: number;
};

async function performAutoCheckoutForAttendance(
  attendance: InstanceType<typeof EmployeeAttendanceModel>,
  now: Date,
  settings: { autoCheckoutTime: string },
  session?: ClientSession
): Promise<AutoCheckoutResult | null> {
  const checkoutTimestamp = resolveAutoCheckoutDeadline(attendance, settings);

  const claimQuery = EmployeeAttendanceModel.findOneAndUpdate(
    openAttendanceFilter({ _id: attendance._id }),
    {
      $set: {
        checkOutTime: checkoutTimestamp,
        autoCheckedOut: true,
        sessionStatus: 'Auto Checked-Out',
      },
    },
    { new: false }
  );
  if (session) claimQuery.session(session);
  const claimed = await claimQuery;
  if (!claimed) {
    console.log(
      `[Auto-Checkout Job] Session already closed for ${attendance.employeeName} — skipping duplicate checkout.`
    );
    return null;
  }

  const checkInTime = claimed.checkInTime;
  const { openLogs, identityTokens } = await findOpenTimesheetsForAutoCheckout(claimed, session);

  const defaultBreakDeductionMs = await resolveDefaultCheckoutBreakDeduction(
    claimed.employeeId,
    claimed.date,
  );

  console.log(
    `[Auto-Checkout Job] Found ${openLogs.length} open timesheet log(s) for ${claimed.employeeName} (tokens=${identityTokens.join(',')}).`
  );

  if (claimed.activeBreakType) {
    const breakType = claimed.activeBreakType;
    const timesheetId = claimed.breakPausedTimesheetId;
    const endedAt =
      claimed.activeBreakEndsAt && activeBreakExpired(claimed, checkoutTimestamp)
        ? claimed.activeBreakEndsAt
        : checkoutTimestamp;
    const breakMs = recordCompletedBreakDuration(claimed, breakType, endedAt);
    await markDailyBreakSlotCompleted(claimed.employeeId, claimed.date, breakType, endedAt, breakMs);
    const appliedMs = await applyDailyCappedBreakDeduction(claimed.employeeId, claimed.date, breakMs);
    await resumeBreakPausedTask(timesheetId, identityTokens, appliedMs);
    claimed.activeBreakType = undefined;
    claimed.activeBreakStartedAt = undefined;
    claimed.activeBreakEndsAt = undefined;
    claimed.breakPausedTimesheetId = undefined;
  }

  const updatedLogs = finalizeOpenTimesheetsForCheckout(claimed, openLogs, checkoutTimestamp, {
    incompleteTaskStatus: true,
    workDayType: 'full_day',
    defaultBreakDeductionMs,
  });

  claimed.workDayType = 'full_day';
  claimed.sessionWorkedMs =
    typeof updatedLogs[0]?.workedMs === 'number' && updatedLogs[0].workedMs >= 0
      ? updatedLogs[0].workedMs
      : undefined;

  const openLogIds = new Set(openLogs.map((log) => log._id.toString()));
  for (const log of updatedLogs) {
    if (openLogIds.has(log._id.toString())) {
      log.autoCheckedOut = true;
    }
    await log.save(session ? { session } : undefined);
    await syncProjectForTimesheet(log, session);

    if (!openLogIds.has(log._id.toString())) continue;

    const assignedQuery = AssignedTaskModel.findOne({ timesheetId: log._id });
    if (session) assignedQuery.session(session);
    const assignedTask = await assignedQuery;
    if (assignedTask) {
      assignedTask.status = 'assigned';
      assignedTask.timesheetId = undefined;
      await assignedTask.save(session ? { session } : undefined);
    }
  }

  await claimed.save(session ? { session } : undefined);

  if (defaultBreakDeductionMs > 0) {
    await applyDailyCappedBreakDeduction(
      claimed.employeeId,
      claimed.date,
      defaultBreakDeductionMs,
    );
  }

  void closeProductiveSessionsForEmployee(
    identityTokens,
    WORK_SESSION_REASONS.SESSION_EXPIRED,
    checkoutTimestamp,
  ).catch((err) => console.error('[auto-checkout] productive time sync failed:', err));

  const totalDurationMs =
    openLogs.length > 0
      ? sumTimesheetWorkedMs(openLogs, checkoutTimestamp)
      : Math.max(0, checkoutTimestamp.getTime() - checkInTime.getTime());

  const primaryLog =
    openLogs.find((log) => log.taskStatus === 'Session Incomplete') ||
    openLogs.find((log) => log.project) ||
    openLogs[0];

  const primaryProject = primaryLog?.project || 'No active project';
  const workDescription = primaryLog?.task || undefined;

  return {
    checkedOut: true,
    totalDurationMs,
    projectName: primaryProject,
    workDescription,
    checkOutTime: checkoutTimestamp,
    checkInTime: claimed.checkInTime,
    employeeEmail: claimed.employeeEmail,
    employeeName: claimed.employeeName,
    closedLogCount: openLogs.length,
  };
}

async function runAutoCheckoutWithOptionalTransaction(
  attendance: InstanceType<typeof EmployeeAttendanceModel>,
  now: Date,
  settings: { autoCheckoutTime: string },
): Promise<AutoCheckoutResult | null> {
  const session = await mongoose.startSession();
  try {
    let result: AutoCheckoutResult | null = null;
    await session.withTransaction(async () => {
      result = await performAutoCheckoutForAttendance(attendance, now, settings, session);
    });
    return result;
  } catch (error) {
    if (!isTransactionUnsupportedError(error)) throw error;
    console.warn(
      `[Auto-Checkout Job] MongoDB transactions unavailable — falling back to non-transactional checkout for ${attendance.employeeName}.`
    );
    return performAutoCheckoutForAttendance(attendance, now, settings);
  } finally {
    session.endSession();
  }
}

export async function processAutoCheckouts(): Promise<number> {
  const settings = await getAutoCheckoutSettings();
  if (!settings.enabled) {
    console.log('[Auto-Checkout Job] Disabled via auto-checkout settings.');
    return 0;
  }

  const query = openAttendanceFilter({ autoCheckoutEnabled: true });
  const now = new Date();

  console.log(`[Auto-Checkout Job] Scanning for open sessions at ${now.toISOString()}`);
  const activeAttendances = await EmployeeAttendanceModel.find(query);

  console.log(`[Auto-Checkout Job] Open sessions found: ${activeAttendances.length}`);

  let checkedOutCount = 0;

  for (const attendance of activeAttendances) {
    const checkInTime = attendance.checkInTime;
    const elapsedMinutes = Math.floor((now.getTime() - checkInTime.getTime()) / (60 * 1000));
    const isEligible = isAutoCheckoutDue(attendance, settings, now);
    const resolvedDeadline = resolveAutoCheckoutDeadline(attendance, settings);

    console.log(
      `[Auto-Checkout Job] Session: ID=${attendance._id}, EmployeeID=${attendance.employeeId}, EmployeeName=${attendance.employeeName}, Status=${attendance.sessionStatus}, Check-in=${checkInTime.toISOString()}, StoredAutoCheckout=${attendance.autoCheckoutTime?.toISOString() ?? 'n/a'}, ResolvedDeadline=${resolvedDeadline.toISOString()} (${formatSchedulerDateTime(resolvedDeadline)} ${env.schedulerTimezone}), ElapsedMinutes=${elapsedMinutes}, AutoCheckoutEligible=${isEligible}`
    );

    if (!isEligible) continue;

    console.log(`[Auto-Checkout Job] Auto checkout triggered for ${attendance.employeeName}`);

    try {
      const result = await runAutoCheckoutWithOptionalTransaction(attendance, now, settings);
      if (!result?.checkedOut) {
        console.warn(
          `[Auto-Checkout Job] Auto-checkout did not complete for ${attendance.employeeName}.`
        );
        continue;
      }

      console.log(
        `[Auto-Checkout Job] MongoDB update success for ${attendance.employeeName}. Status set to Auto Checked-Out. Closed ${result.closedLogCount} log(s), duration=${formatDurationFromMs(result.totalDurationMs)}.`
      );
      checkedOutCount++;

      if (result.employeeEmail) {
        console.log(
          `[Auto-Checkout Job] Sending confirmation email to ${result.employeeEmail}...`
        );
        const emailSent = await sendAutoCheckoutConfirmationEmail({
          to: result.employeeEmail,
          employeeName: result.employeeName,
          checkInTime: result.checkInTime,
          checkOutTime: result.checkOutTime,
          totalDurationMs: result.totalDurationMs,
          projectName: result.projectName,
          workDescription: result.workDescription,
          autoCheckoutReason: `Your session remained active past the scheduled auto-checkout time (${settings.autoCheckoutTime}).`,
        });
        if (emailSent) {
          console.log(
            `[Auto-Checkout Job] Confirmation email sent successfully to ${result.employeeEmail}`
          );
        } else {
          console.log(
            `[Auto-Checkout Job] Failed to send confirmation email to ${result.employeeEmail}`
          );
        }
      }
    } catch (error) {
      console.error(
        `[Auto-Checkout Job] Auto-checkout failed for ${attendance.employeeName}:`,
        error
      );
    }
  }

  console.log(
    `[Auto-Checkout Job] Processing complete. Checked out: ${checkedOutCount}/${activeAttendances.length}`
  );
  return checkedOutCount;
}
