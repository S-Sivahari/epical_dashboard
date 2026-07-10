import cron, { type ScheduledTask } from 'node-cron';
import { env } from '../config/env';
import { ensureAnnualLeaveBalanceReset } from './leaveService';
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
      console.log(`[LeaveReset] Monthly scheduler tick at ${tickAt}`);
      try {
        await ensureFinancialYearSnapshotReset();
        await ensureAnnualLeaveBalanceReset();
      } catch (error) {
        console.error('[LeaveReset] Monthly scheduler failed:', error);
      }
    },
    cronOptions(),
  );

  console.log(
    `[LeaveReset] Scheduled monthly payroll snapshot + annual leave balance check (${cronExpr}, timezone=${env.schedulerTimezone})`,
  );

  try {
    await ensureFinancialYearSnapshotReset();
    await ensureAnnualLeaveBalanceReset();
  } catch (error) {
    console.error('[LeaveReset] Startup scheduler check failed:', error);
  }
}

export function stopLeaveMonthlyResetScheduler() {
  if (monthlyResetJob) {
    monthlyResetJob.stop();
    monthlyResetJob = null;
  }
}
