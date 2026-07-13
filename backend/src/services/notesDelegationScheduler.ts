import cron, { type ScheduledTask } from 'node-cron';
import { env } from '../config/env';
import { formatSchedulerDateTime } from '../utils/istClock';
import {
  notesDelegationMorningCron,
  processMorningDelegationReminders,
} from './notesDelegationNotificationService';

let morningJob: ScheduledTask | null = null;

function cronOptions() {
  return { timezone: env.schedulerTimezone };
}

export function initNotesDelegationScheduler() {
  if (morningJob) {
    morningJob.stop();
    morningJob = null;
  }

  const cronExpr = notesDelegationMorningCron();
  morningJob = cron.schedule(
    cronExpr,
    async () => {
      const tickAt = formatSchedulerDateTime(new Date());
      console.log(`[NotesDelegation] Morning reminder cron tick at ${tickAt}`);
      await processMorningDelegationReminders();
    },
    cronOptions(),
  );

  console.log(
    `[NotesDelegation] Scheduled morning reminders (${cronExpr}, timezone=${env.schedulerTimezone})`,
  );
}

export function stopNotesDelegationScheduler() {
  if (morningJob) {
    morningJob.stop();
    morningJob = null;
  }
}
