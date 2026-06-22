import cron, { type ScheduledTask } from 'node-cron';
import { env } from '../config/env';
import { ensureMonthlyLeaveHistoryReset, ensureAnnualLeaveBalanceReset } from './leaveService';
import { ensureFinancialYearSnapshotReset } from './payrollYtdService';

let monthlyResetJob: ScheduledTask | null = null;

function cronOptions() {
  return { timezone: env.schedulerTimezone };
}

export async function initLeaveMonthlyResetScheduler() {
  if (monthlyResetJob) {
    monthlyResetJob.stop();
    monthlyResetJob = null;
  }

  const cronExpr = env.testCronTimings ? '* * * * *' : '5 0 1 * *';

  monthlyResetJob = cron.schedule(
    cronExpr,
    async () => {
      const tickAt = new Date().toISOString();
      console.log(`[LeaveReset] Monthly cron tick at ${tickAt}`);
      try {
        await ensureFinancialYearSnapshotReset();
        await ensureAnnualLeaveBalanceReset();
        await ensureMonthlyLeaveHistoryReset();
      } catch (error) {
        console.error('[LeaveReset] Monthly reset failed:', error);
      }
    },
    cronOptions(),
  );

  console.log(
    `[LeaveReset] Scheduled monthly leave history reset (${cronExpr}, timezone=${env.schedulerTimezone})`,
  );

  try {
    await ensureFinancialYearSnapshotReset();
    await ensureAnnualLeaveBalanceReset();
    const startup = await ensureMonthlyLeaveHistoryReset();
    if (startup.ran) {
      console.log(
        `[LeaveReset] Startup catch-up reset removed ${startup.deletedCount ?? 0} leave record(s)`,
      );
    }
  } catch (error) {
    console.error('[LeaveReset] Startup reset check failed:', error);
  }
}

export function stopLeaveMonthlyResetScheduler() {
  if (monthlyResetJob) {
    monthlyResetJob.stop();
    monthlyResetJob = null;
  }
}
