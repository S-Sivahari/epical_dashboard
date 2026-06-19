import { CellWorkflowWorkLogModel } from '../models/CellWorkflowWorkLog';
import { WORK_SESSION_REASONS } from '../utils/workSessionReason';
import { TimesheetModel } from '../models/Timesheet';

export type DashboardChartPeriod = 'This Week' | 'This Month' | 'Last Month' | 'Last 2 Months' | 'Custom';

export type DashboardChartPoint = { name: string; hours: number };

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function formatDateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getDashboardChartRange(period: DashboardChartPeriod) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let start = new Date(today);
  let end = new Date(today);

  switch (period) {
    case 'This Week': {
      const day = today.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      start.setDate(today.getDate() + diffToMon);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      break;
    }
    case 'This Month':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
    case 'Last Month':
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    case 'Last 2 Months':
      end = new Date(today);
      start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      break;
  }

  return { from: formatDateKey(start), to: formatDateKey(end) };
}

function roundHours(hours: number) {
  return Math.round(hours * 10) / 10;
}

export function effectiveTimesheetHours(
  t: {
    loginTime?: Date;
    logoutTime?: Date | null;
    overriddenHours?: number | null;
    totalHours?: number | null;
    totalPausedMs?: number;
    taskStatus?: string;
  },
  now = new Date(),
): number {
  if (t.overriddenHours != null && t.overriddenHours !== undefined) {
    return Math.max(0, Number(t.overriddenHours));
  }

  if (!t.loginTime) return 0;

  const login = new Date(t.loginTime);
  let end = t.logoutTime ? new Date(t.logoutTime) : now;

  if (!t.logoutTime) {
    const elapsedMs = now.getTime() - login.getTime();
    const maxOpenMs = 16 * 60 * 60 * 1000;
    if (elapsedMs > maxOpenMs) {
      end = new Date(login.getTime() + maxOpenMs);
    }
  }

  const paused = t.totalPausedMs ?? 0;
  const diffMs = end.getTime() - login.getTime() - paused;
  if (diffMs <= 0) return 0;
  return roundHours(diffMs / 3600000);
}

export function effectiveCellLogHours(
  log: { checkInTime: Date; checkOutTime?: Date | null; workedMs?: number },
  now = new Date(),
): number {
  if (log.workedMs && log.workedMs > 0) {
    return roundHours(log.workedMs / 3600000);
  }
  if (!log.checkInTime) return 0;
  const start = new Date(log.checkInTime);
  const end = log.checkOutTime ? new Date(log.checkOutTime) : now;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 0;
  return roundHours(diffMs / 3600000);
}

function formatBucketLabel(start: Date, end: Date): string {
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (sameMonth) {
    return `${startLabel}–${end.getDate()}`;
  }
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startLabel}–${endLabel}`;
}

function addHoursToDayBucket(byDay: Record<string, number>, date: Date, hours: number) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const key = dayNames[date.getDay()];
  byDay[key] = (byDay[key] || 0) + hours;
}

function aggregateWeeklyChart(
  timesheets: Array<{
    loginTime?: Date;
    logoutTime?: Date | null;
    overriddenHours?: number | null;
    totalHours?: number | null;
    totalPausedMs?: number;
    taskStatus?: string;
  }>,
  cellLogs: Array<{ checkInTime: Date; checkOutTime?: Date | null; workedMs?: number }>,
  now = new Date(),
): DashboardChartPoint[] {
  const byDay: Record<string, number> = {};

  timesheets.forEach((t) => {
    if (!t.loginTime) return;
    addHoursToDayBucket(byDay, new Date(t.loginTime), effectiveTimesheetHours(t, now));
  });

  cellLogs.forEach((log) => {
    addHoursToDayBucket(byDay, new Date(log.checkInTime), effectiveCellLogHours(log, now));
  });

  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((name) => ({
    name,
    hours: roundHours(byDay[name] || 0),
  }));
}

function daysInRange(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

function aggregateDailyChart(
  timesheets: Array<{
    loginTime?: Date;
    logoutTime?: Date | null;
    overriddenHours?: number | null;
    totalHours?: number | null;
    totalPausedMs?: number;
    taskStatus?: string;
  }>,
  cellLogs: Array<{ checkInTime: Date; checkOutTime?: Date | null; workedMs?: number }>,
  from: string,
  to: string,
  now = new Date(),
): DashboardChartPoint[] {
  const buckets: { name: string; start: Date; end: Date }[] = [];
  let cursor = new Date(`${from}T00:00:00`);
  const rangeEnd = new Date(`${to}T23:59:59`);

  while (cursor <= rangeEnd) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(cursor);
    bucketEnd.setHours(23, 59, 59, 999);
    buckets.push({
      name: bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      start: bucketStart,
      end: bucketEnd,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets.map((bucket) => {
    let hours = 0;

    timesheets.forEach((t) => {
      if (!t.loginTime) return;
      const login = new Date(t.loginTime);
      if (login >= bucket.start && login <= bucket.end) {
        hours += effectiveTimesheetHours(t, now);
      }
    });

    cellLogs.forEach((log) => {
      const checkIn = new Date(log.checkInTime);
      if (checkIn >= bucket.start && checkIn <= bucket.end) {
        hours += effectiveCellLogHours(log, now);
      }
    });

    return { name: bucket.name, hours: roundHours(hours) };
  });
}

function aggregateRangedChart(
  timesheets: Array<{
    loginTime?: Date;
    logoutTime?: Date | null;
    overriddenHours?: number | null;
    totalHours?: number | null;
    totalPausedMs?: number;
    taskStatus?: string;
  }>,
  cellLogs: Array<{ checkInTime: Date; checkOutTime?: Date | null; workedMs?: number }>,
  from: string,
  to: string,
  now = new Date(),
): DashboardChartPoint[] {
  const buckets: { name: string; start: Date; end: Date }[] = [];
  let cursor = new Date(`${from}T00:00:00`);
  const rangeEnd = new Date(`${to}T23:59:59`);

  while (cursor <= rangeEnd) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(cursor);
    bucketEnd.setDate(bucketEnd.getDate() + 6);
    if (bucketEnd > rangeEnd) bucketEnd.setTime(rangeEnd.getTime());

    buckets.push({
      name: formatBucketLabel(bucketStart, bucketEnd),
      start: bucketStart,
      end: bucketEnd,
    });

    cursor.setDate(cursor.getDate() + 7);
  }

  return buckets.map((bucket) => {
    let hours = 0;

    timesheets.forEach((t) => {
      if (!t.loginTime) return;
      const login = new Date(t.loginTime);
      if (login >= bucket.start && login <= bucket.end) {
        hours += effectiveTimesheetHours(t, now);
      }
    });

    cellLogs.forEach((log) => {
      const checkIn = new Date(log.checkInTime);
      if (checkIn >= bucket.start && checkIn <= bucket.end) {
        hours += effectiveCellLogHours(log, now);
      }
    });

    return { name: bucket.name, hours: roundHours(hours) };
  });
}

export async function buildDashboardProjectHoursChart(
  period: DashboardChartPeriod,
  from?: string,
  to?: string,
) {
  const range = from && to ? { from, to } : getDashboardChartRange(period);
  const loginFrom = new Date(`${range.from}T00:00:00.000Z`);
  const loginTo = new Date(`${range.to}T23:59:59.999Z`);
  const now = new Date();

  const [timesheets, cellLogs] = await Promise.all([
    TimesheetModel.find({
      loginTime: { $gte: loginFrom, $lte: loginTo },
    })
      .select('loginTime logoutTime overriddenHours totalHours totalPausedMs taskStatus')
      .lean(),
    CellWorkflowWorkLogModel.find({
      checkInTime: { $gte: loginFrom, $lte: loginTo },
      $or: [
        { reason: WORK_SESSION_REASONS.WORKING },
        { reason: { $exists: false } },
      ],
    })
      .select('checkInTime checkOutTime workedMs')
      .lean(),
  ]);

  const chartData =
    period === 'This Week'
      ? aggregateWeeklyChart(timesheets, cellLogs, now)
      : period === 'Custom' && daysInRange(range.from, range.to) <= 7
        ? aggregateDailyChart(timesheets, cellLogs, range.from, range.to, now)
        : aggregateRangedChart(timesheets, cellLogs, range.from, range.to, now);

  const totalPeriodHours = roundHours(chartData.reduce((sum, point) => sum + point.hours, 0));

  return {
    chartData,
    totalPeriodHours,
    from: range.from,
    to: range.to,
  };
}
