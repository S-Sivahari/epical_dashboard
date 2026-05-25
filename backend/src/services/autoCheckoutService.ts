import mongoose from 'mongoose';
import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';
import { AutoCheckoutSettingsModel } from '../models/AutoCheckoutSettings';
import { TimesheetModel } from '../models/Timesheet';
import { AssignedTaskModel } from '../models/AssignedTask';
import { syncProjectForTimesheet } from '../utils/syncProject';
import { sendCheckoutReminderEmail, sendAutoCheckoutConfirmationEmail } from './emailService';
import { env } from '../config/env';

function computeTotalHours(loginTime: Date, logoutTime: Date, totalPausedMs = 0): number {
  const diffMs = logoutTime.getTime() - loginTime.getTime() - (totalPausedMs || 0);
  if (diffMs <= 0) return 0;
  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
}

function finalizePauseAccumulation(timesheet: { pausedAt?: Date | null; totalPausedMs?: number }) {
  if (!timesheet.pausedAt) return;
  const pausedMs = Date.now() - new Date(timesheet.pausedAt).getTime();
  timesheet.totalPausedMs = (timesheet.totalPausedMs || 0) + Math.max(0, pausedMs);
  timesheet.pausedAt = null;
}

export async function getAutoCheckoutSettings() {
  let settings = await AutoCheckoutSettingsModel.findOne();
  if (!settings) {
    settings = await AutoCheckoutSettingsModel.create({
      reminderTime: env.DEFAULT_REMINDER_TIME,
      autoCheckoutTime: env.DEFAULT_AUTO_CHECKOUT_TIME,
      enabled: true,
    });
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
  if (!settings.enabled) return 0;

  const activeAttendances = await EmployeeAttendanceModel.find({
    checkOutTime: { $exists: false },
    sessionStatus: 'Active',
    reminderSent: false,
    autoCheckoutEnabled: true,
  });

  if (activeAttendances.length === 0) return 0;

  let sentCount = 0;
  for (const attendance of activeAttendances) {
    const email = attendance.employeeEmail;
    if (!email) {
      console.log(`⚠ No email for employee ${attendance.employeeName} — skipping reminder`);
      attendance.reminderSent = true;
      await attendance.save();
      continue;
    }

    const sent = await sendCheckoutReminderEmail({
      to: email,
      employeeName: attendance.employeeName,
      checkInTime: attendance.checkInTime,
      autoCheckoutTime: settings.autoCheckoutTime,
    });

    attendance.reminderSent = true;
    await attendance.save();

    if (sent) sentCount++;
  }

  console.log(`✓ Reminders processed: ${sentCount}/${activeAttendances.length}`);
  return sentCount;
}

export async function processAutoCheckouts(): Promise<number> {
  const settings = await getAutoCheckoutSettings();
  if (!settings.enabled) return 0;

  const activeAttendances = await EmployeeAttendanceModel.find({
    checkOutTime: { $exists: false },
    sessionStatus: 'Active',
    autoCheckoutEnabled: true,
  });

  if (activeAttendances.length === 0) return 0;

  let checkedOutCount = 0;
  const now = new Date();

  for (const attendance of activeAttendances) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const openLogs = await TimesheetModel.find({
          $or: [
            { employeeId: attendance.employeeId },
            { employee: attendance.employeeName },
          ],
          $and: [{ $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }] }],
        }).session(session);

        for (const log of openLogs) {
          if (log.taskStatus === 'Paused') {
            finalizePauseAccumulation(log);
          }
          log.logoutTime = now;
          log.totalHours = computeTotalHours(
            log.loginTime,
            now,
            log.totalPausedMs
          );
          if (['In Progress', 'Paused', 'Session Incomplete'].includes(log.taskStatus || '')) {
            log.taskStatus = 'Pending';
          }
          await log.save({ session });
          await syncProjectForTimesheet(log, session);

          const assignedTask = await AssignedTaskModel.findOne({ timesheetId: log._id }).session(session);
          if (assignedTask) {
            assignedTask.status = 'assigned';
            assignedTask.timesheetId = undefined;
            await assignedTask.save({ session });
          }
        }

        const totalHoursToday = openLogs.reduce((sum, l) => sum + (l.totalHours || 0), 0);

        attendance.checkOutTime = now;
        attendance.autoCheckedOut = true;
        attendance.sessionStatus = 'Auto Checked-Out';
        await attendance.save({ session });

        if (attendance.employeeEmail) {
          await sendAutoCheckoutConfirmationEmail({
            to: attendance.employeeEmail,
            employeeName: attendance.employeeName,
            checkInTime: attendance.checkInTime,
            checkOutTime: now,
            totalHours: Math.round(totalHoursToday * 10) / 10,
          });
        }
      });

      checkedOutCount++;
    } catch (error) {
      console.error(`✗ Auto-checkout failed for ${attendance.employeeName}:`, error);
    } finally {
      session.endSession();
    }
  }

  console.log(`✓ Auto-checkouts processed: ${checkedOutCount}/${activeAttendances.length}`);
  return checkedOutCount;
}
