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
  if (!settings.enabled) {
    console.log('[Reminder Job] Disabled via auto-checkout settings.');
    return 0;
  }

  const query: any = {
    checkOutTime: { $exists: false },
    sessionStatus: { $in: ['Active', 'Paused'] },
    reminderSent: false,
    autoCheckoutEnabled: true,
  };

  console.log(`[Reminder Job] Scanning for open sessions. Query: ${JSON.stringify(query)}`);
  const activeAttendances = await EmployeeAttendanceModel.find(query);

  console.log(`[Reminder Job] Open sessions found: ${activeAttendances.length}`);

  let sentCount = 0;
  const now = new Date();

  for (const attendance of activeAttendances) {
    const checkInTime = attendance.checkInTime;
    const elapsedMs = now.getTime() - checkInTime.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
    
    let isEligible = false;
    if (env.testCronTimings) {
      isEligible = elapsedMinutes >= 2;
    } else {
      isEligible = true;
    }

    console.log(`[Reminder Job] Session: ID=${attendance._id}, EmployeeID=${attendance.employeeId}, EmployeeName=${attendance.employeeName}, Status=${attendance.sessionStatus}, Check-in=${checkInTime.toISOString()}, CurrentTime=${now.toISOString()}, ElapsedMinutes=${elapsedMinutes}, ReminderEligible=${isEligible}`);

    if (!isEligible) {
      continue;
    }

    const email = attendance.employeeEmail;
    if (!email) {
      console.log(`[Reminder Job] ⚠ No email for employee ${attendance.employeeName} — skipping reminder`);
      attendance.reminderSent = true;
      await attendance.save();
      continue;
    }

    console.log(`Sending reminder email to: ${email}`);
    const sent = await sendCheckoutReminderEmail({
      to: email,
      employeeName: attendance.employeeName,
      checkInTime: attendance.checkInTime,
      autoCheckoutTime: settings.autoCheckoutTime,
    });

    if (sent) {
      attendance.reminderSent = true;
      await attendance.save();
      console.log(`✓ Reminder email sent successfully to ${email}`);
      sentCount++;
    } else {
      console.log(`✗ Failed to send reminder email to ${email}. Will retry on next tick.`);
    }
  }

  console.log(`[Reminder Job] Completed. Sent: ${sentCount}`);
  return sentCount;
}

export async function processAutoCheckouts(): Promise<number> {
  const settings = await getAutoCheckoutSettings();
  if (!settings.enabled) {
    console.log('[Auto-Checkout Job] Disabled via auto-checkout settings.');
    return 0;
  }

  const query: any = {
    checkOutTime: { $exists: false },
    sessionStatus: { $in: ['Active', 'Paused'] },
    autoCheckoutEnabled: true,
  };

  console.log(`[Auto-Checkout Job] Scanning for open sessions. Query: ${JSON.stringify(query)}`);
  const activeAttendances = await EmployeeAttendanceModel.find(query);

  console.log(`[Auto-Checkout Job] Open sessions found: ${activeAttendances.length}`);

  let checkedOutCount = 0;
  const now = new Date();

  for (const attendance of activeAttendances) {
    const checkInTime = attendance.checkInTime;
    const elapsedMs = now.getTime() - checkInTime.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));

    let isEligible = false;
    if (env.testCronTimings) {
      isEligible = elapsedMinutes >= 5;
    } else {
      isEligible = true;
    }

    console.log(`[Auto-Checkout Job] Session: ID=${attendance._id}, EmployeeID=${attendance.employeeId}, EmployeeName=${attendance.employeeName}, Status=${attendance.sessionStatus}, Check-in=${checkInTime.toISOString()}, CurrentTime=${now.toISOString()}, ElapsedMinutes=${elapsedMinutes}, AutoCheckoutEligible=${isEligible}`);

    if (!isEligible) {
      continue;
    }

    console.log(`Auto checkout triggered for ${attendance.employeeName}`);
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

        console.log(`[Auto-Checkout Job] Found ${openLogs.length} open timesheet log(s) for ${attendance.employeeName}.`);

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

        console.log(`[Auto-Checkout Job] MongoDB update success for ${attendance.employeeName}. Status set to Auto Checked-Out.`);

        if (attendance.employeeEmail) {
          console.log(`[Auto-Checkout Job] Attempting to send confirmation email to ${attendance.employeeEmail}...`);
          const emailSent = await sendAutoCheckoutConfirmationEmail({
            to: attendance.employeeEmail,
            employeeName: attendance.employeeName,
            checkInTime: attendance.checkInTime,
            checkOutTime: now,
            totalHours: Math.round(totalHoursToday * 10) / 10,
          });
          if (emailSent) {
            console.log(`[Auto-Checkout Job] ✓ Confirmation email sent successfully to ${attendance.employeeEmail}`);
          } else {
            console.log(`[Auto-Checkout Job] ✗ Failed to send confirmation email to ${attendance.employeeEmail}`);
          }
        }
      });

      console.log(`[Auto-Checkout Job] Frontend synchronization completed for ${attendance.employeeName}.`);
      checkedOutCount++;
    } catch (error) {
      console.error(`[Auto-Checkout Job] ✗ Auto-checkout failed for ${attendance.employeeName}:`, error);
    } finally {
      session.endSession();
    }
  }

  console.log(`[Auto-Checkout Job] Processing complete. Checked out: ${checkedOutCount}/${activeAttendances.length}`);
  return checkedOutCount;
}

