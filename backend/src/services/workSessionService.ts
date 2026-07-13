import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';
import { TimesheetModel } from '../models/Timesheet';
import { getDB } from '../config/db';
import { buildAssignmentIdentityTokens } from '../utils/assignedTaskSync';
import { computeUsedBreakMs, computeGrossAttendanceMs, DAILY_STANDARD_BREAK_MS } from '../utils/workBreaks';
import { calendarDayBounds } from '../utils/istClock';
import { computeSessionWorkedMs, resolveSessionWorkedMs, formatWorkedMsLabel, type WorkDayType } from './workingTimeService';

export type WorkSessionRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  project: string;
  projectId?: string;
  projects: string[];
  date: string;
  loginTime: string;
  logoutTime?: string;
  breakMs: number;
  displayBreakMs: number;
  displayWorkedMs: number;
  defaultBreakDeductedMs?: number;
  workDayType: 'half_day' | 'full_day' | null;
  sessionStatus: string;
  autoCheckedOut: boolean;
};

type SessionQuery = {
  from?: string;
  to?: string;
  employee?: string;
  search?: string;
};

type EmployeeSessionContext = {
  identityTokens: string[];
  officialEmployeeId: string;
  displayName: string;
};

type TaskProjectRow = {
  project?: string | null;
  projectId?: { toString(): string } | string | null;
  employee?: string | null;
  employeeId?: string | null;
  loginTime?: Date | string;
  logoutTime?: Date | string | null;
};

/** Allow slight clock skew between attendance check-in and timesheet loginTime. */
const PROJECT_MATCH_SLACK_MS = 60_000;

function employeeDisplayNameFromRecord(employee: {
  firstName?: string;
  middleName?: string;
  lastName?: string;
}): string {
  return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ').trim();
}

function taskMatchesIdentity(task: TaskProjectRow, tokens: Set<string>): boolean {
  const employeeId = String(task.employeeId || '').trim();
  const employeeName = String(task.employee || '').trim();
  return (Boolean(employeeId) && tokens.has(employeeId)) || (Boolean(employeeName) && tokens.has(employeeName));
}

function taskOverlapsAttendanceWindow(
  task: TaskProjectRow,
  checkInTime: Date,
  windowEnd: Date,
): boolean {
  const loginMs = new Date(task.loginTime as Date).getTime();
  if (!Number.isFinite(loginMs)) return false;

  const checkInMs = checkInTime.getTime();
  const endMs = windowEnd.getTime();
  if (loginMs < checkInMs - PROJECT_MATCH_SLACK_MS || loginMs > endMs + PROJECT_MATCH_SLACK_MS) {
    return false;
  }

  const logout = task.logoutTime ? new Date(task.logoutTime).getTime() : null;
  if (logout != null && Number.isFinite(logout) && logout < checkInMs - PROJECT_MATCH_SLACK_MS) {
    return false;
  }
  return true;
}

function pinnedProjectsFromAttendance(attendance: {
  checkedInProjectId?: string | null;
  checkedInProjectName?: string | null;
}): { names: string[]; projectId?: string } {
  const name = String(attendance.checkedInProjectName || '').trim();
  if (!name || name === '—') return { names: [] };
  if (name === 'Multiple') {
    return { names: ['Multiple'], projectId: attendance.checkedInProjectId ? String(attendance.checkedInProjectId) : undefined };
  }
  return {
    names: [name],
    projectId: attendance.checkedInProjectId ? String(attendance.checkedInProjectId) : undefined,
  };
}

async function buildEmployeeContextMap(
  attendances: Array<{ employeeId: string; employeeName: string }>,
): Promise<Map<string, EmployeeSessionContext>> {
  const uniqueKeys = new Map<string, { employeeId: string; employeeName: string }>();
  for (const attendance of attendances) {
    uniqueKeys.set(attendance.employeeId, attendance);
  }

  const ids = [...uniqueKeys.keys()];
  const contextMap = new Map<string, EmployeeSessionContext>();

  if (ids.length === 0) return contextMap;

  try {
    const employees = await getDB()
      .collection('employees')
      .find({ $or: [{ id: { $in: ids } }, { employeeId: { $in: ids } }] })
      .toArray();

    for (const [authUserId, attendance] of uniqueKeys) {
      const employee = employees.find(
        (row) => row.id === authUserId || row.employeeId === authUserId,
      );
      const displayName = employee
        ? employeeDisplayNameFromRecord(employee as any) || attendance.employeeName
        : attendance.employeeName;
      const officialEmployeeId = employee?.employeeId
        ? String(employee.employeeId)
        : authUserId;

      contextMap.set(authUserId, {
        officialEmployeeId,
        displayName,
        identityTokens: employee
          ? buildAssignmentIdentityTokens(
              {
                id: String(employee.id || authUserId),
                name: displayName,
                employeeId: officialEmployeeId,
                email: typeof employee.email === 'string' ? employee.email : undefined,
              },
              employee as any,
            )
          : [authUserId, attendance.employeeName].filter(Boolean),
      });
    }
  } catch {
    for (const [authUserId, attendance] of uniqueKeys) {
      contextMap.set(authUserId, {
        officialEmployeeId: authUserId,
        displayName: attendance.employeeName,
        identityTokens: [authUserId, attendance.employeeName].filter(Boolean),
      });
    }
  }

  return contextMap;
}

function sessionBreakMs(attendance: {
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
}): number {
  const end = attendance.checkOutTime ? new Date(attendance.checkOutTime) : new Date();
  return computeUsedBreakMs(attendance, end);
}

function sessionDisplayBreakMs(attendance: {
  checkOutTime?: Date | null;
  defaultBreakDeductedMs?: number | null;
  morningBreakAt?: Date | null;
  lunchBreakAt?: Date | null;
  eveningBreakAt?: Date | null;
  morningBreakMs?: number | null;
  lunchBreakMs?: number | null;
  eveningBreakMs?: number | null;
  activeBreakType?: 'morning' | 'lunch' | 'evening' | null;
  activeBreakStartedAt?: Date | null;
  activeBreakEndsAt?: Date | null;
}): number {
  const actualMs = sessionBreakMs(attendance);
  if (actualMs > 0) return actualMs;

  if (typeof attendance.defaultBreakDeductedMs === 'number' && attendance.defaultBreakDeductedMs > 0) {
    return DAILY_STANDARD_BREAK_MS;
  }

  return 0;
}

/** Same worked ms shown in employee work history for a completed session. */
export function getAttendanceSessionWorkedMs(attendance: {
  checkInTime: Date;
  checkOutTime?: Date | null;
  workDayType?: WorkDayType | null;
  sessionWorkedMs?: number | null;
  defaultBreakDeductedMs?: number | null;
  morningBreakAt?: Date | null;
  lunchBreakAt?: Date | null;
  eveningBreakAt?: Date | null;
  morningBreakMs?: number | null;
  lunchBreakMs?: number | null;
  eveningBreakMs?: number | null;
  activeBreakType?: 'morning' | 'lunch' | 'evening' | null;
  activeBreakStartedAt?: Date | null;
  activeBreakEndsAt?: Date | null;
}): number {
  return resolveAttendanceHistoryMetrics(attendance).displayWorkedMs;
}

function resolveAttendanceHistoryMetrics(attendance: {
  checkInTime: Date;
  checkOutTime?: Date | null;
  workDayType?: WorkDayType | null;
  sessionWorkedMs?: number | null;
  defaultBreakDeductedMs?: number | null;
  morningBreakAt?: Date | null;
  lunchBreakAt?: Date | null;
  eveningBreakAt?: Date | null;
  morningBreakMs?: number | null;
  lunchBreakMs?: number | null;
  eveningBreakMs?: number | null;
  activeBreakType?: 'morning' | 'lunch' | 'evening' | null;
  activeBreakStartedAt?: Date | null;
  activeBreakEndsAt?: Date | null;
}): { displayWorkedMs: number; displayBreakMs: number } {
  if (!attendance.checkOutTime) {
    return { displayWorkedMs: 0, displayBreakMs: 0 };
  }

  const checkOut = new Date(attendance.checkOutTime);
  const workDayType: WorkDayType = attendance.workDayType === 'half_day' ? 'half_day' : 'full_day';
  const defaultMs =
    typeof attendance.defaultBreakDeductedMs === 'number' && attendance.defaultBreakDeductedMs > 0
      ? DAILY_STANDARD_BREAK_MS
      : 0;

  const preview = computeSessionWorkedMs(
    attendance.checkInTime,
    checkOut,
    attendance,
    workDayType,
    defaultMs,
  );

  return {
    displayWorkedMs: preview.workedMs,
    displayBreakMs: sessionDisplayBreakMs(attendance),
  };
}

/** Human-readable break label for admin/activity views. */
export function formatAttendanceBreakLabel(attendance: {
  checkOutTime?: Date | null;
  defaultBreakDeductedMs?: number | null;
  morningBreakAt?: Date | null;
  lunchBreakAt?: Date | null;
  eveningBreakAt?: Date | null;
  morningBreakMs?: number | null;
  lunchBreakMs?: number | null;
  eveningBreakMs?: number | null;
  activeBreakType?: 'morning' | 'lunch' | 'evening' | null;
  activeBreakStartedAt?: Date | null;
  activeBreakEndsAt?: Date | null;
}): string | null {
  if (!attendance.checkOutTime) return null;

  const actualMs = sessionBreakMs(attendance);
  if (actualMs > 0) {
    return formatWorkedMsLabel(actualMs);
  }

  if (typeof attendance.defaultBreakDeductedMs === 'number' && attendance.defaultBreakDeductedMs > 0) {
    return `${formatWorkedMsLabel(DAILY_STANDARD_BREAK_MS)} (default)`;
  }

  return null;
}

async function projectsForAttendanceWindow(
  attendance: {
    employeeId: string;
    employeeName: string;
    checkInTime: Date;
    checkOutTime?: Date | null;
    date?: string;
    checkedInProjectId?: string | null;
    checkedInProjectName?: string | null;
  },
  identityTokens: string[],
): Promise<{ names: string[]; projectId?: string }> {
  const pinned = pinnedProjectsFromAttendance(attendance);
  if (pinned.names.length === 1 && pinned.names[0] !== 'Multiple') return pinned;

  const tokens = Array.from(
    new Set(
      [...identityTokens, attendance.employeeId, attendance.employeeName]
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  );
  if (tokens.length === 0) return { names: [] };

  const checkInTime = new Date(attendance.checkInTime);
  const windowEnd = attendance.checkOutTime ? new Date(attendance.checkOutTime) : new Date();
  const dayKey = String(attendance.date || '').trim();
  const dayBounds = dayKey.includes('-') ? calendarDayBounds(dayKey) : null;
  const rangeStart = dayBounds
    ? new Date(Math.min(checkInTime.getTime() - PROJECT_MATCH_SLACK_MS, dayBounds.start.getTime()))
    : new Date(checkInTime.getTime() - PROJECT_MATCH_SLACK_MS);
  const rangeEnd = dayBounds
    ? new Date(Math.max(windowEnd.getTime() + PROJECT_MATCH_SLACK_MS, dayBounds.end.getTime()))
    : new Date(windowEnd.getTime() + PROJECT_MATCH_SLACK_MS);

  const tasks = await TimesheetModel.find({
    $and: [
      {
        $or: [{ employeeId: { $in: tokens } }, { employee: { $in: tokens } }],
      },
      { loginTime: { $gte: rangeStart, $lte: rangeEnd } },
    ],
  })
    .select({ project: 1, projectId: 1, employee: 1, employeeId: 1, loginTime: 1, logoutTime: 1 })
    .sort({ loginTime: 1 })
    .lean();

  const tokenSet = new Set(tokens);
  return projectsFromTasksForWindow(tasks, checkInTime, windowEnd, tokenSet);
}

function projectsFromTasksForWindow(
  tasks: TaskProjectRow[],
  checkInTime: Date,
  windowEnd: Date,
  attendanceTokens?: Set<string>,
): { names: string[]; projectId?: string } {
  const names: string[] = [];
  const seen = new Set<string>();
  let projectId: string | undefined;

  for (const task of tasks) {
    if (attendanceTokens && !taskMatchesIdentity(task, attendanceTokens)) continue;
    if (!taskOverlapsAttendanceWindow(task, checkInTime, windowEnd)) continue;
    const project = String(task.project || '').trim();
    if (!project || seen.has(project)) {
      if (project && !projectId && task.projectId) {
        projectId = String(task.projectId);
      }
      continue;
    }
    seen.add(project);
    names.push(project);
    if (!projectId && task.projectId) {
      projectId = String(task.projectId);
    }
  }
  return { names, projectId };
}

function formatProjectLabel(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length > 1) return 'Multiple';
  return '—';
}

/** Batch-load timesheets once, then enrich many attendance rows in memory. */
export async function enrichAttendanceHistoryRows(
  records: Array<{
    _id: { toString(): string };
    employeeId: string;
    employeeName: string;
    date: string;
    checkInTime: Date;
    checkOutTime?: Date | null;
    sessionStatus?: string;
    autoCheckedOut?: boolean;
    workDayType?: 'half_day' | 'full_day' | null;
    sessionWorkedMs?: number | null;
    defaultBreakDeductedMs?: number | null;
    morningBreakAt?: Date | null;
    lunchBreakAt?: Date | null;
    eveningBreakAt?: Date | null;
    morningBreakMs?: number | null;
    lunchBreakMs?: number | null;
    eveningBreakMs?: number | null;
    activeBreakType?: 'morning' | 'lunch' | 'evening' | null;
    activeBreakStartedAt?: Date | null;
    activeBreakEndsAt?: Date | null;
    checkedInProjectId?: string | null;
    checkedInProjectName?: string | null;
  }>,
  identityTokens: string[] = [],
): Promise<WorkSessionRow[]> {
  if (records.length === 0) return [];

  const tokens = Array.from(
    new Set(
      [
        ...identityTokens,
        ...records.flatMap((r) => [r.employeeId, r.employeeName]),
      ]
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  );

  let tasks: TaskProjectRow[] = [];
  if (tokens.length > 0) {
    const minCheckIn = Math.min(...records.map((r) => new Date(r.checkInTime).getTime()));
    const maxEnd = Math.max(
      ...records.map((r) =>
        r.checkOutTime ? new Date(r.checkOutTime).getTime() : Date.now(),
      ),
    );
    const dateKeys = records.map((r) => String(r.date || '').trim()).filter(Boolean);
    let rangeStart = minCheckIn - PROJECT_MATCH_SLACK_MS;
    let rangeEnd = maxEnd + PROJECT_MATCH_SLACK_MS;
    for (const dateKey of dateKeys) {
      if (!dateKey.includes('-')) continue;
      const bounds = calendarDayBounds(dateKey);
      rangeStart = Math.min(rangeStart, bounds.start.getTime());
      rangeEnd = Math.max(rangeEnd, bounds.end.getTime());
    }

    tasks = await TimesheetModel.find({
      $and: [
        { $or: [{ employeeId: { $in: tokens } }, { employee: { $in: tokens } }] },
        { loginTime: { $gte: new Date(rangeStart), $lte: new Date(rangeEnd) } },
      ],
    })
      .select({ project: 1, projectId: 1, employee: 1, employeeId: 1, loginTime: 1, logoutTime: 1 })
      .sort({ loginTime: 1 })
      .lean();
  }

  const sharedTokenSet = new Set(tokens);

  return records.map((attendance) => {
    const checkInTime = new Date(attendance.checkInTime);
    const windowEnd = attendance.checkOutTime ? new Date(attendance.checkOutTime) : new Date();
    const pinned = pinnedProjectsFromAttendance(attendance);
    let matched =
      pinned.names.length === 1 && pinned.names[0] !== 'Multiple'
        ? pinned
        : projectsFromTasksForWindow(tasks, checkInTime, windowEnd, sharedTokenSet);
    if (matched.names.length === 0 && pinned.names.length > 0) {
      matched = pinned;
    }
    const projectNames = matched.names;
    const { displayWorkedMs, displayBreakMs } = resolveAttendanceHistoryMetrics(attendance);
    const breakMs = sessionBreakMs(attendance);

    return {
      id: String(attendance._id),
      employeeId: attendance.employeeId,
      employeeName: attendance.employeeName,
      project: formatProjectLabel(projectNames),
      projectId: matched.projectId,
      projects: projectNames,
      date: attendance.date,
      loginTime: checkInTime.toISOString(),
      logoutTime: attendance.checkOutTime ? new Date(attendance.checkOutTime).toISOString() : undefined,
      breakMs,
      displayBreakMs,
      displayWorkedMs,
      defaultBreakDeductedMs: attendance.defaultBreakDeductedMs ?? 0,
      workDayType: attendance.workDayType ?? (attendance.autoCheckedOut ? 'full_day' : null),
      sessionStatus: attendance.checkOutTime
        ? (attendance.sessionStatus ?? 'Completed')
        : (attendance.sessionStatus ?? 'Active'),
      autoCheckedOut: attendance.autoCheckedOut ?? false,
    };
  });
}

function workedMsFromTimesheetRow(task: {
  workedMs?: number | null;
  totalHours?: number | null;
  overriddenHours?: number | null;
}): number | null {
  if (typeof task.workedMs === 'number' && task.workedMs >= 0) {
    return task.workedMs;
  }
  if (task.overriddenHours != null && Number.isFinite(Number(task.overriddenHours))) {
    return Math.max(0, Math.round(Number(task.overriddenHours) * 3600000));
  }
  if (task.totalHours != null && Number(task.totalHours) > 0) {
    return Math.max(0, Math.round(Number(task.totalHours) * 3600000));
  }
  return null;
}

/**
 * Display worked ms for a completed session. Prefers values frozen at checkout:
 * sessionWorkedMs → legacy timesheet workedMs/totalHours → recompute (no new 50m on read).
 */
export async function resolveStoredSessionWorkedMs(
  attendance: {
    employeeId: string;
    employeeName: string;
    checkInTime: Date;
    checkOutTime?: Date | null;
    sessionWorkedMs?: number | null;
    defaultBreakDeductedMs?: number | null;
    autoCheckedOut?: boolean;
    workDayType?: 'half_day' | 'full_day' | null;
    morningBreakAt?: Date | null;
    lunchBreakAt?: Date | null;
    eveningBreakAt?: Date | null;
    morningBreakMs?: number | null;
    lunchBreakMs?: number | null;
    eveningBreakMs?: number | null;
    activeBreakType?: 'morning' | 'lunch' | 'evening' | null;
    activeBreakStartedAt?: Date | null;
    activeBreakEndsAt?: Date | null;
  },
  identityTokens: string[] = [],
): Promise<number> {
  if (typeof attendance.sessionWorkedMs === 'number' && attendance.sessionWorkedMs >= 0) {
    if (attendance.checkOutTime) {
      const grossMs = computeGrossAttendanceMs(
        attendance.checkInTime,
        new Date(attendance.checkOutTime),
      );
      if (attendance.sessionWorkedMs <= grossMs) {
        return attendance.sessionWorkedMs;
      }
    } else {
      return attendance.sessionWorkedMs;
    }
  }

  if (!attendance.checkOutTime) {
    return resolveSessionWorkedMs(attendance as any);
  }

  const workDayType: WorkDayType = attendance.workDayType === 'half_day' ? 'half_day' : 'full_day';
  const defaultMs =
    typeof attendance.defaultBreakDeductedMs === 'number' && attendance.defaultBreakDeductedMs > 0
      ? DAILY_STANDARD_BREAK_MS
      : 0;

  return computeSessionWorkedMs(
    attendance.checkInTime,
    new Date(attendance.checkOutTime),
    attendance,
    workDayType,
    defaultMs,
  ).workedMs;
}

export async function enrichAttendanceSessionRow(
  attendance: {
    _id: { toString(): string };
    employeeId: string;
    employeeName: string;
    date: string;
    checkInTime: Date;
    checkOutTime?: Date | null;
    sessionStatus?: string;
    autoCheckedOut?: boolean;
    workDayType?: 'half_day' | 'full_day' | null;
    sessionWorkedMs?: number | null;
    defaultBreakDeductedMs?: number | null;
    morningBreakAt?: Date | null;
    lunchBreakAt?: Date | null;
    eveningBreakAt?: Date | null;
    morningBreakMs?: number | null;
    lunchBreakMs?: number | null;
    eveningBreakMs?: number | null;
    activeBreakType?: 'morning' | 'lunch' | 'evening' | null;
    activeBreakStartedAt?: Date | null;
    activeBreakEndsAt?: Date | null;
    checkedInProjectId?: string | null;
    checkedInProjectName?: string | null;
  },
  identityTokens: string[] = [],
): Promise<WorkSessionRow> {
  const matched = await projectsForAttendanceWindow(attendance, identityTokens);
  const { displayWorkedMs, displayBreakMs } = resolveAttendanceHistoryMetrics(attendance);
  const breakMs = sessionBreakMs(attendance);

  return {
    id: String(attendance._id),
    employeeId: attendance.employeeId,
    employeeName: attendance.employeeName,
    project: formatProjectLabel(matched.names),
    projectId: matched.projectId,
    projects: matched.names.filter((n) => n !== 'Multiple'),
    date: attendance.date,
    loginTime: new Date(attendance.checkInTime).toISOString(),
    logoutTime: attendance.checkOutTime ? new Date(attendance.checkOutTime).toISOString() : undefined,
    breakMs,
    displayBreakMs,
    displayWorkedMs,
    defaultBreakDeductedMs: attendance.defaultBreakDeductedMs ?? 0,
    workDayType: attendance.workDayType ?? (attendance.autoCheckedOut ? 'full_day' : null),
    sessionStatus: attendance.checkOutTime
      ? (attendance.sessionStatus ?? 'Completed')
      : (attendance.sessionStatus ?? 'Active'),
    autoCheckedOut: attendance.autoCheckedOut ?? false,
  };
}

export async function listWorkSessionsForAdmin(query: SessionQuery): Promise<WorkSessionRow[]> {
  const match: Record<string, unknown> = {};

  if (query.from || query.to) {
    const checkInTime: Record<string, Date> = {};
    if (query.from) {
      const fromKey = query.from;
      checkInTime.$gte = fromKey.includes('-')
        ? calendarDayBounds(fromKey).start
        : new Date(`${fromKey}T00:00:00.000Z`);
    }
    if (query.to) {
      const toKey = query.to;
      checkInTime.$lte = toKey.includes('-')
        ? calendarDayBounds(toKey).end
        : new Date(`${toKey}T23:59:59.999Z`);
    }
    match.checkInTime = checkInTime;
  }

  if (query.employee && query.employee !== 'all') {
    match.employeeName = query.employee;
  }

  if (query.search?.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    match.$or = [{ employeeName: searchRegex }];
  }

  const attendances = await EmployeeAttendanceModel.find(match)
    .select({
      employeeId: 1,
      employeeName: 1,
      date: 1,
      checkInTime: 1,
      checkOutTime: 1,
      sessionStatus: 1,
      autoCheckedOut: 1,
      workDayType: 1,
      sessionWorkedMs: 1,
      defaultBreakDeductedMs: 1,
      morningBreakAt: 1,
      lunchBreakAt: 1,
      eveningBreakAt: 1,
      morningBreakMs: 1,
      lunchBreakMs: 1,
      eveningBreakMs: 1,
      activeBreakType: 1,
      activeBreakStartedAt: 1,
      activeBreakEndsAt: 1,
      checkedInProjectId: 1,
      checkedInProjectName: 1,
    })
    .sort({ checkInTime: -1 })
    .limit(5000)
    .lean();

  const employeeContextMap = await buildEmployeeContextMap(attendances);

  // Batch-load timesheets once for all attendances (avoids N+1 and identity gaps).
  const allTokens = new Set<string>();
  const attendanceTokenSets = new Map<string, Set<string>>();
  for (const attendance of attendances) {
    const context = employeeContextMap.get(attendance.employeeId);
    const tokens = Array.from(
      new Set(
        [
          ...(context?.identityTokens ?? []),
          attendance.employeeId,
          attendance.employeeName,
          context?.officialEmployeeId,
          context?.displayName,
        ]
          .map((value) => String(value || '').trim())
          .filter(Boolean),
      ),
    );
    const tokenSet = new Set(tokens);
    attendanceTokenSets.set(String(attendance._id), tokenSet);
    tokens.forEach((t) => allTokens.add(t));
  }

  let tasks: TaskProjectRow[] = [];
  if (attendances.length > 0 && allTokens.size > 0) {
    const minCheckIn = Math.min(...attendances.map((r) => new Date(r.checkInTime).getTime()));
    const maxEnd = Math.max(
      ...attendances.map((r) =>
        r.checkOutTime ? new Date(r.checkOutTime).getTime() : Date.now(),
      ),
    );
    let rangeStart = minCheckIn - PROJECT_MATCH_SLACK_MS;
    let rangeEnd = maxEnd + PROJECT_MATCH_SLACK_MS;
    for (const attendance of attendances) {
      const dateKey = String(attendance.date || '').trim();
      if (!dateKey.includes('-')) continue;
      const bounds = calendarDayBounds(dateKey);
      rangeStart = Math.min(rangeStart, bounds.start.getTime());
      rangeEnd = Math.max(rangeEnd, bounds.end.getTime());
    }

    tasks = await TimesheetModel.find({
      $and: [
        { $or: [{ employeeId: { $in: [...allTokens] } }, { employee: { $in: [...allTokens] } }] },
        { loginTime: { $gte: new Date(rangeStart), $lte: new Date(rangeEnd) } },
      ],
    })
      .select({ project: 1, projectId: 1, employee: 1, employeeId: 1, loginTime: 1, logoutTime: 1 })
      .sort({ loginTime: 1 })
      .lean();
  }

  const rows: WorkSessionRow[] = [];
  for (const attendance of attendances) {
    const context = employeeContextMap.get(attendance.employeeId);
    const tokenSet =
      attendanceTokenSets.get(String(attendance._id)) ??
      new Set([attendance.employeeId, attendance.employeeName].filter(Boolean));

    const checkInTime = new Date(attendance.checkInTime);
    const windowEnd = attendance.checkOutTime ? new Date(attendance.checkOutTime) : new Date();
    const pinned = pinnedProjectsFromAttendance(attendance);
    let matched =
      pinned.names.length === 1 && pinned.names[0] !== 'Multiple'
        ? pinned
        : projectsFromTasksForWindow(tasks, checkInTime, windowEnd, tokenSet);
    if (matched.names.length === 0 && pinned.names.length > 0) {
      matched = pinned;
    }

    const { displayWorkedMs, displayBreakMs } = resolveAttendanceHistoryMetrics(attendance);
    const breakMs = sessionBreakMs(attendance);

    rows.push({
      id: String(attendance._id),
      employeeId: context?.officialEmployeeId ?? attendance.employeeId,
      employeeName: context?.displayName ?? attendance.employeeName,
      project: formatProjectLabel(matched.names),
      projectId: matched.projectId,
      projects: matched.names.filter((n) => n !== 'Multiple'),
      date: attendance.date,
      loginTime: checkInTime.toISOString(),
      logoutTime: attendance.checkOutTime
        ? new Date(attendance.checkOutTime).toISOString()
        : undefined,
      breakMs,
      displayBreakMs,
      displayWorkedMs,
      defaultBreakDeductedMs: attendance.defaultBreakDeductedMs ?? 0,
      workDayType: attendance.workDayType ?? (attendance.autoCheckedOut ? 'full_day' : null),
      sessionStatus: attendance.checkOutTime
        ? (attendance.sessionStatus ?? 'Completed')
        : (attendance.sessionStatus ?? 'Active'),
      autoCheckedOut: attendance.autoCheckedOut ?? false,
    });

    // Persist resolved project onto older attendance rows that never stored it.
    const hasPinned = Boolean(String(attendance.checkedInProjectName || '').trim());
    if (!hasPinned && matched.names.length > 0) {
      const projectLabel = formatProjectLabel(matched.names);
      void EmployeeAttendanceModel.updateOne(
        { _id: attendance._id },
        {
          $set: {
            checkedInProjectName: projectLabel,
            ...(matched.projectId ? { checkedInProjectId: matched.projectId } : {}),
          },
        },
      ).catch(() => undefined);
    }
  }

  return rows;
}
