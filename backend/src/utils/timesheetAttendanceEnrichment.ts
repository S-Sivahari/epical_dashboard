import { getDB } from '../config/db';
import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';
import { buildAssignmentIdentityTokens } from './assignedTaskSync';
import { computeWorkedMs, resolveDisplayWorkedMs } from './durationFormat';
import { getSchedulerDateKey } from './istClock';
import { computeGrossAttendanceMs, computeUsedBreakMs } from './workBreaks';
import { resolveSessionWorkedMs } from '../services/workingTimeService';

type TimesheetIdentity = {
  employee?: string;
  employeeId?: string;
  loginTime?: Date | string;
  breakMs?: number;
};

export type AttendanceSessionRow = {
  date: string;
  employeeId: string;
  employeeName: string;
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
  sessionWorkedMs?: number | null;
  workDayType?: 'half_day' | 'full_day' | null;
  autoCheckedOut?: boolean;
};

function dateKeyFromLogin(loginTime?: Date | string | null): string {
  if (!loginTime) return '';
  return getSchedulerDateKey(new Date(loginTime));
}

function sharesIdentity(
  entry: TimesheetIdentity,
  attendance: Pick<AttendanceSessionRow, 'employeeId' | 'employeeName'>,
  employeeTokenMap: Map<string, string[]>,
): boolean {
  const entryTokens = new Set(collectIdentityTokens(entry, employeeTokenMap));
  const attendanceTokens = collectIdentityTokens(
    { employee: attendance.employeeName, employeeId: attendance.employeeId },
    employeeTokenMap,
  );
  return attendanceTokens.some((token) => entryTokens.has(token));
}

export async function buildEmployeeTokenMap(
  entries: TimesheetIdentity[],
): Promise<Map<string, string[]>> {
  const lookupKeys = new Set<string>();
  for (const entry of entries) {
    if (entry.employeeId?.trim()) lookupKeys.add(entry.employeeId.trim());
    if (entry.employee?.trim()) lookupKeys.add(entry.employee.trim());
  }
  if (lookupKeys.size === 0) return new Map();

  const db = getDB();
  const employees = await db
    .collection('employees')
    .find({
      $or: [
        { employeeId: { $in: [...lookupKeys] } },
        { id: { $in: [...lookupKeys] } },
      ],
    })
    .project({
      id: 1,
      employeeId: 1,
      firstName: 1,
      middleName: 1,
      lastName: 1,
      email: 1,
    })
    .toArray();

  const map = new Map<string, string[]>();
  for (const emp of employees) {
    const tokens = buildAssignmentIdentityTokens(
      { id: emp.id, employeeId: emp.employeeId, email: emp.email },
      emp as Parameters<typeof buildAssignmentIdentityTokens>[1],
    );
    for (const token of tokens) {
      map.set(token, tokens);
    }
    const fullName = [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(' ').trim();
    if (fullName) map.set(fullName, tokens);
    const shortName = [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim();
    if (shortName) map.set(shortName, tokens);
  }
  return map;
}

export function collectIdentityTokens(
  entry: TimesheetIdentity,
  employeeTokenMap: Map<string, string[]>,
): string[] {
  const tokens = new Set<string>();
  const add = (value?: string) => {
    const trimmed = value?.trim();
    if (trimmed) tokens.add(trimmed);
  };

  add(entry.employee);
  add(entry.employeeId);

  for (const key of [entry.employee?.trim(), entry.employeeId?.trim()]) {
    if (!key) continue;
    const mapped = employeeTokenMap.get(key);
    if (mapped) mapped.forEach((t) => tokens.add(t));
  }

  return Array.from(tokens);
}

/** Attendance check-in sessions that overlap the given timesheet rows. */
export async function fetchAttendanceSessionsForTimesheets(
  entries: TimesheetIdentity[],
  employeeTokenMap?: Map<string, string[]>,
): Promise<AttendanceSessionRow[]> {
  const tokenMap = employeeTokenMap ?? (await buildEmployeeTokenMap(entries));

  const dates = new Set<string>();
  const names = new Set<string>();
  const employeeIds = new Set<string>();

  for (const entry of entries) {
    const date = dateKeyFromLogin(entry.loginTime);
    if (date) dates.add(date);
    if (entry.employee?.trim()) names.add(entry.employee.trim());
    for (const token of collectIdentityTokens(entry, tokenMap)) {
      employeeIds.add(token);
    }
  }

  if (dates.size === 0) return [];

  const attendanceOr: Array<Record<string, unknown>> = [];
  if (names.size > 0) attendanceOr.push({ employeeName: { $in: [...names] } });
  if (employeeIds.size > 0) attendanceOr.push({ employeeId: { $in: [...employeeIds] } });
  if (attendanceOr.length === 0) return [];

  return EmployeeAttendanceModel.find({
    date: { $in: [...dates] },
    $or: attendanceOr,
  })
    .select({
      date: 1,
      employeeId: 1,
      employeeName: 1,
      checkInTime: 1,
      checkOutTime: 1,
      morningBreakAt: 1,
      lunchBreakAt: 1,
      eveningBreakAt: 1,
      morningBreakMs: 1,
      lunchBreakMs: 1,
      eveningBreakMs: 1,
      activeBreakType: 1,
      activeBreakStartedAt: 1,
      activeBreakEndsAt: 1,
      sessionWorkedMs: 1,
      defaultBreakDeductedMs: 1,
      workDayType: 1,
      autoCheckedOut: 1,
    })
    .sort({ checkInTime: 1 })
    .lean();
}

export function findAttendanceSessionForTimesheet(
  entry: TimesheetIdentity,
  attendances: AttendanceSessionRow[],
  employeeTokenMap: Map<string, string[]>,
): AttendanceSessionRow | undefined {
  if (!entry.loginTime) return undefined;

  const loginMs = new Date(entry.loginTime).getTime();
  if (!Number.isFinite(loginMs)) return undefined;

  let best: AttendanceSessionRow | undefined;
  let bestSpan = Number.POSITIVE_INFINITY;

  for (const attendance of attendances) {
    if (!sharesIdentity(entry, attendance, employeeTokenMap)) continue;

    const start = new Date(attendance.checkInTime).getTime();
    const end = attendance.checkOutTime
      ? new Date(attendance.checkOutTime).getTime()
      : Date.now();

    if (!Number.isFinite(start) || loginMs < start || loginMs > end) continue;

    const span = end - start;
    if (span < bestSpan) {
      best = attendance;
      bestSpan = span;
    }
  }

  return best;
}

/**
 * Break time for one admin timesheet row.
 * Uses the persisted checkout value first (including explicit 0).
 * Falls back to breaks taken during the matching check-in session only — never whole-day totals.
 */
export function resolveTimesheetBreakMs(
  entry: TimesheetIdentity,
  attendances: AttendanceSessionRow[],
  employeeTokenMap: Map<string, string[]>,
): number | undefined {
  if (typeof entry.breakMs === 'number' && entry.breakMs >= 0) {
    return entry.breakMs;
  }

  const attendance = findAttendanceSessionForTimesheet(entry, attendances, employeeTokenMap);
  if (!attendance) return undefined;

  const end = attendance.checkOutTime ? new Date(attendance.checkOutTime) : new Date();
  return computeUsedBreakMs(attendance, end);
}

/**
 * Admin duration: match activity log / employee history.
 * Uses checkout workedMs when set; otherwise session net when the task spans the check-in session.
 */
export function resolveAdminTimesheetWorkedMs(
  entry: TimesheetIdentity & {
    logoutTime?: Date | string | null;
    workedMs?: number;
    overriddenHours?: number | null;
    totalHours?: number | null;
    totalPausedMs?: number | null;
  },
  attendances: AttendanceSessionRow[],
  employeeTokenMap: Map<string, string[]>,
): number {
  if (entry.logoutTime && typeof entry.workedMs === 'number' && entry.workedMs >= 0) {
    return entry.workedMs;
  }

  const attendance = findAttendanceSessionForTimesheet(entry, attendances, employeeTokenMap);
  if (entry.loginTime && entry.logoutTime && attendance?.checkOutTime) {
    const taskMs = computeWorkedMs(
      new Date(entry.loginTime),
      new Date(entry.logoutTime),
      entry.totalPausedMs || 0,
    );
    const sessionGross = computeGrossAttendanceMs(
      new Date(attendance.checkInTime),
      new Date(attendance.checkOutTime),
    );
    if (Math.abs(taskMs - sessionGross) <= 60_000) {
      return resolveSessionWorkedMs(attendance);
    }
    return taskMs;
  }

  return resolveDisplayWorkedMs({
    workedMs: entry.workedMs,
    overriddenHours: entry.overriddenHours,
    totalHours: entry.totalHours,
    loginTime: entry.loginTime,
    logoutTime: entry.logoutTime,
    totalPausedMs: entry.totalPausedMs,
  });
}

/** @deprecated Use fetchAttendanceSessionsForTimesheets + resolveTimesheetBreakMs */
export async function buildDayBreakMsLookup(
  entries: TimesheetIdentity[],
  employeeTokenMap?: Map<string, string[]>,
): Promise<Map<string, number>> {
  const tokenMap = employeeTokenMap ?? (await buildEmployeeTokenMap(entries));
  const attendances = await fetchAttendanceSessionsForTimesheets(entries, tokenMap);
  const map = new Map<string, number>();
  for (const entry of entries) {
    const breakMs = resolveTimesheetBreakMs(entry, attendances, tokenMap);
    if (typeof breakMs === 'number' && breakMs >= 0) {
      map.set(entry.loginTime?.toString() ?? '', breakMs);
    }
  }
  return map;
}

/** @deprecated Use resolveTimesheetBreakMs */
export function resolveTimesheetDayBreakMs(
  entry: TimesheetIdentity,
  lookup: Map<string, number>,
  employeeTokenMap?: Map<string, string[]>,
): number | undefined {
  void employeeTokenMap;
  const fromLookup = lookup.get(entry.loginTime?.toString() ?? '');
  if (typeof fromLookup === 'number' && fromLookup >= 0) return fromLookup;
  if (typeof entry.breakMs === 'number' && entry.breakMs >= 0) return entry.breakMs;
  return undefined;
}
