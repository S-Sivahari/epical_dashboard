import cron, { type ScheduledTask } from 'node-cron';
import { getAutoCheckoutSettings } from './autoCheckoutService';
import { processReminders, processAutoCheckouts } from './autoCheckoutService';
import { env } from '../config/env';

let reminderJob: ScheduledTask | null = null;
let autoCheckoutJob: ScheduledTask | null = null;
let overdueSweepJob: ScheduledTask | null = null;

function timeToCron(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    throw new Error(`Invalid HH:mm time value: "${timeStr}"`);
  }
  return `${minutes} ${hours} * * *`;
}

function cronOptions() {
  return { timezone: env.schedulerTimezone };
}

async function scheduleJobs() {
  const settings = await getAutoCheckoutSettings();

  if (reminderJob) {
    console.log('[Scheduler] Stopping existing reminder job.');
    reminderJob.stop();
    reminderJob = null;
  }
  if (autoCheckoutJob) {
    console.log('[Scheduler] Stopping existing auto-checkout job.');
    autoCheckoutJob.stop();
    autoCheckoutJob = null;
  }
  if (overdueSweepJob) {
    console.log('[Scheduler] Stopping existing overdue sweep job.');
    overdueSweepJob.stop();
    overdueSweepJob = null;
  }

  if (!settings.enabled) {
    console.log('[Scheduler] Auto-checkout scheduler disabled via settings');
    return;
  }

  const reminderCron = env.testCronTimings ? '* * * * *' : timeToCron(settings.reminderTime);
  const autoCheckoutCron = env.testCronTimings ? '* * * * *' : timeToCron(settings.autoCheckoutTime);
  const overdueSweepCron = env.testCronTimings ? '* * * * *' : '*/5 * * * *';

  console.log(
    `[Scheduler] Configuring jobs (timezone=${env.schedulerTimezone}, testMode=${env.testCronTimings})`
  );
  console.log(
    `[Scheduler] Reminder=${settings.reminderTime} (${reminderCron}), Auto-checkout=${settings.autoCheckoutTime} (${autoCheckoutCron}), Overdue sweep=${overdueSweepCron}`
  );

  reminderJob = cron.schedule(
    reminderCron,
    async () => {
      const tickAt = new Date().toISOString();
      console.log(`[Scheduler] Reminder cron tick at ${tickAt}`);
      try {
        await processReminders();
      } catch (error) {
        console.error('[Scheduler] Reminder job error:', error);
      }
    },
    cronOptions()
  );

  autoCheckoutJob = cron.schedule(
    autoCheckoutCron,
    async () => {
      const tickAt = new Date().toISOString();
      console.log(`[Scheduler] Auto-checkout cron tick at ${tickAt}`);
      try {
        await processAutoCheckouts();
      } catch (error) {
        console.error('[Scheduler] Auto-checkout job error:', error);
      }
    },
    cronOptions()
  );

  overdueSweepJob = cron.schedule(
    overdueSweepCron,
    async () => {
      if (env.testCronTimings) return;
      try {
        await processAutoCheckouts();
      } catch (error) {
        console.error('[Scheduler] Overdue auto-checkout sweep error:', error);
      }
    },
    cronOptions()
  );

  console.log('[Scheduler] Timesheet scheduler initialized');
}

export async function initScheduler() {
  try {
    await scheduleJobs();
    console.log('[Scheduler] Running startup overdue auto-checkout sweep...');
    await processAutoCheckouts();
  } catch (error) {
    console.error('[Scheduler] Failed to initialize scheduler:', error);
  }
}

export async function restartScheduler() {
  console.log('[Scheduler] Restarting with updated settings...');
  await scheduleJobs();
}

export function stopScheduler() {
  if (reminderJob) {
    reminderJob.stop();
    reminderJob = null;
  }
  if (autoCheckoutJob) {
    autoCheckoutJob.stop();
    autoCheckoutJob = null;
  }
  if (overdueSweepJob) {
    overdueSweepJob.stop();
    overdueSweepJob = null;
  }
  console.log('[Scheduler] Scheduler stopped');
}
