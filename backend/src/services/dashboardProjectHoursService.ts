import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';
import { computeWorkingHours } from '../services/workingTimeService';

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

export function effectiveAttendanceHours(
  attendance: {
    checkInTime: Date;
    checkOutTime?: Date | null;
    morningBreakAt?: Date | null;
    lunchBreakAt?: Date | null;
    eveningBreakAt?: Date | null;
    morningBreakMs?: number | null;
    lunchBreakMs?: number | null;
    eveningBreakMs?: number | null;
    activeBreakType?: 'morning' | 'lunch' | 'evening' | null;
    activeBreakStartedAt?: Date | null;
    activeBreakEndsAt?: Date | null;
    workDayType?: 'half_day' | 'full_day' | null;
  },
  now = new Date(),
): number {
  if (!attendance.checkInTime) return 0;
  return computeWorkingHours(
    {
      checkInTime: new Date(attendance.checkInTime),
      checkOutTime: attendance.checkOutTime ? new Date(attendance.checkOutTime) : null,
      morningBreakAt: attendance.morningBreakAt,
      lunchBreakAt: attendance.lunchBreakAt,
      eveningBreakAt: attendance.eveningBreakAt,
      morningBreakMs: attendance.morningBreakMs,
      lunchBreakMs: attendance.lunchBreakMs,
      eveningBreakMs: attendance.eveningBreakMs,
      activeBreakType: attendance.activeBreakType,
      activeBreakStartedAt: attendance.activeBreakStartedAt,
      activeBreakEndsAt: attendance.activeBreakEndsAt,
      workDayType: attendance.workDayType,
    },
    { now },
  );
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
  attendances: Array<{
    checkInTime: Date;
    checkOutTime?: Date | null;
    morningBreakAt?: Date | null;
    lunchBreakAt?: Date | null;
    eveningBreakAt?: Date | null;
  }>,
  now = new Date(),
): DashboardChartPoint[] {
  const byDay: Record<string, number> = {};

  attendances.forEach((attendance) => {
    if (!attendance.checkInTime) return;
    addHoursToDayBucket(byDay, new Date(attendance.checkInTime), effectiveAttendanceHours(attendance, now));
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
  attendances: Array<{
    checkInTime: Date;
    checkOutTime?: Date | null;
    morningBreakAt?: Date | null;
    lunchBreakAt?: Date | null;
    eveningBreakAt?: Date | null;
  }>,
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

    attendances.forEach((attendance) => {
      if (!attendance.checkInTime) return;
      const checkIn = new Date(attendance.checkInTime);
      if (checkIn >= bucket.start && checkIn <= bucket.end) {
        hours += effectiveAttendanceHours(attendance, now);
      }
    });

    return { name: bucket.name, hours: roundHours(hours) };
  });
}

function aggregateRangedChart(
  attendances: Array<{
    checkInTime: Date;
    checkOutTime?: Date | null;
    morningBreakAt?: Date | null;
    lunchBreakAt?: Date | null;
    eveningBreakAt?: Date | null;
  }>,
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

    attendances.forEach((attendance) => {
      if (!attendance.checkInTime) return;
      const checkIn = new Date(attendance.checkInTime);
      if (checkIn >= bucket.start && checkIn <= bucket.end) {
        hours += effectiveAttendanceHours(attendance, now);
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

  const attendances = await EmployeeAttendanceModel.find({
    checkInTime: { $gte: loginFrom, $lte: loginTo },
  })
    .select(
      'checkInTime checkOutTime morningBreakAt lunchBreakAt eveningBreakAt morningBreakMs lunchBreakMs eveningBreakMs activeBreakType activeBreakStartedAt activeBreakEndsAt workDayType',
    )
    .lean();

  const chartData =
    period === 'This Week'
      ? aggregateWeeklyChart(attendances, now)
      : period === 'Custom' && daysInRange(range.from, range.to) <= 7
        ? aggregateDailyChart(attendances, range.from, range.to, now)
        : aggregateRangedChart(attendances, range.from, range.to, now);

  const totalPeriodHours = roundHours(chartData.reduce((sum, point) => sum + point.hours, 0));

  return {
    chartData,
    totalPeriodHours,
    from: range.from,
    to: range.to,
  };
}
