import cron, { type ScheduledTask } from 'node-cron';
import { getAutoCheckoutSettings } from './autoCheckoutService';
import { processReminders, processAutoCheckouts } from './autoCheckoutService';

let reminderJob: ScheduledTask | null = null;
let autoCheckoutJob: ScheduledTask | null = null;

function timeToCron(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return `${minutes} ${hours} * * *`;
}

async function scheduleJobs() {
  const settings = await getAutoCheckoutSettings();

  if (reminderJob) {
    reminderJob.stop();
    reminderJob = null;
  }
  if (autoCheckoutJob) {
    autoCheckoutJob.stop();
    autoCheckoutJob = null;
  }

  if (!settings.enabled) {
    console.log('⚠ Auto-checkout scheduler disabled via settings');
    return;
  }

  const reminderCron = timeToCron(settings.reminderTime);
  const autoCheckoutCron = timeToCron(settings.autoCheckoutTime);

  reminderJob = cron.schedule(reminderCron, async () => {
    console.log(`[Scheduler] Running reminder job at ${new Date().toISOString()}`);
    try {
      await processReminders();
    } catch (error) {
      console.error('[Scheduler] Reminder job error:', error);
    }
  });

  autoCheckoutJob = cron.schedule(autoCheckoutCron, async () => {
    console.log(`[Scheduler] Running auto-checkout job at ${new Date().toISOString()}`);
    try {
      await processAutoCheckouts();
    } catch (error) {
      console.error('[Scheduler] Auto-checkout job error:', error);
    }
  });

  console.log(`✓ Scheduler started — Reminder: ${settings.reminderTime} (${reminderCron}), Auto-checkout: ${settings.autoCheckoutTime} (${autoCheckoutCron})`);
}

export async function initScheduler() {
  try {
    await scheduleJobs();
  } catch (error) {
    console.error('✗ Failed to initialize scheduler:', error);
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
  console.log('✓ Scheduler stopped');
}
