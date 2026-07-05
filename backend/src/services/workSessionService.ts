import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';
import { TimesheetModel } from '../models/Timesheet';
import { getDB } from '../config/db';
import { buildAssignmentIdentityTokens } from '../utils/assignedTaskSync';
import { computeUsedBreakMs } from '../utils/workBreaks';
import { resolveSessionWorkedMs } from './workingTimeService';

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
  displayWorkedMs: number;
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

function employeeDisplayNameFromRecord(employee: {
  firstName?: string;
  middleName?: string;
  lastName?: string;
}): string {
  return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ').trim();
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
                id: authUserId,
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

async function projectsForAttendanceWindow(
  attendance: {
    employeeId: string;
    employeeName: string;
    checkInTime: Date;
    checkOutTime?: Date | null;
  },
  identityTokens: string[],
): Promise<string[]> {
  if (!attendance.checkOutTime) return [];
  const tokens = Array.from(
    new Set(
      [...identityTokens, attendance.employeeId, attendance.employeeName]
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  );
  if (tokens.length === 0) return [];

  const checkOutTime = new Date(attendance.checkOutTime);
  const checkInTime = new Date(attendance.checkInTime);

  const tasks = await TimesheetModel.find({
    $and: [
      {
        $or: [{ employeeId: { $in: tokens } }, { employee: { $in: tokens } }],
      },
      { loginTime: { $lte: checkOutTime } },
      {
        $or: [
          { logoutTime: { $gte: checkInTime } },
          { logoutTime: { $exists: false } },
          { logoutTime: null },
        ],
      },
    ],
  })
    .select({ project: 1 })
    .sort({ loginTime: 1 })
    .lean();

  return Array.from(new Set(tasks.map((t) => String(t.project || '').trim()).filter(Boolean)));
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
    return attendance.sessionWorkedMs;
  }

  if (!attendance.checkOutTime) {
    return resolveSessionWorkedMs(attendance as any);
  }

  const tokens = Array.from(
    new Set(
      [...identityTokens, attendance.employeeId, attendance.employeeName]
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  );

  if (tokens.length > 0) {
    const checkOutTime = new Date(attendance.checkOutTime);
    const checkInTime = new Date(attendance.checkInTime);
    const task = await TimesheetModel.findOne({
      $and: [
        {
          $or: [{ employeeId: { $in: tokens } }, { employee: { $in: tokens } }],
        },
        { loginTime: { $lte: checkOutTime } },
        {
          $or: [
            { logoutTime: { $gte: checkInTime } },
            { logoutTime: { $exists: false } },
            { logoutTime: null },
          ],
        },
      ],
    })
      .select({ workedMs: 1, totalHours: 1, overriddenHours: 1 })
      .sort({ loginTime: 1 })
      .lean();

    const fromTimesheet = task ? workedMsFromTimesheetRow(task) : null;
    if (fromTimesheet != null) {
      return fromTimesheet;
    }
  }

  return resolveSessionWorkedMs(attendance as any);
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
  },
  identityTokens: string[] = [],
): Promise<WorkSessionRow> {
  const projectNames = await projectsForAttendanceWindow(attendance, identityTokens);
  const displayWorkedMs = await resolveStoredSessionWorkedMs(attendance, identityTokens);
  const breakMs = sessionBreakMs(attendance);

  return {
    id: String(attendance._id),
    employeeId: attendance.employeeId,
    employeeName: attendance.employeeName,
    project: projectNames.length === 1 ? projectNames[0] : projectNames.length > 1 ? 'Multiple' : '—',
    projects: projectNames,
    date: attendance.date,
    loginTime: new Date(attendance.checkInTime).toISOString(),
    logoutTime: attendance.checkOutTime ? new Date(attendance.checkOutTime).toISOString() : undefined,
    breakMs,
    displayWorkedMs,
    workDayType: attendance.workDayType ?? (attendance.autoCheckedOut ? 'full_day' : null),
    sessionStatus: attendance.sessionStatus ?? 'Completed',
    autoCheckedOut: attendance.autoCheckedOut ?? false,
  };
}

export async function listWorkSessionsForAdmin(query: SessionQuery): Promise<WorkSessionRow[]> {
  const match: Record<string, unknown> = {
    checkOutTime: { $exists: true, $ne: null },
  };

  if (query.from || query.to) {
    const checkInTime: Record<string, Date> = {};
    if (query.from) checkInTime.$gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) checkInTime.$lte = new Date(`${query.to}T23:59:59.999Z`);
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
    })
    .sort({ checkInTime: -1 })
    .limit(5000)
    .lean();

  const rows: WorkSessionRow[] = [];
  const employeeContextMap = await buildEmployeeContextMap(attendances);

  for (const attendance of attendances) {
    if (!attendance.checkOutTime) continue;
    const context = employeeContextMap.get(attendance.employeeId);
    const identityTokens = context?.identityTokens ?? [
      attendance.employeeId,
      attendance.employeeName,
    ];
    const row = await enrichAttendanceSessionRow(attendance, identityTokens);
    row.employeeId = context?.officialEmployeeId ?? attendance.employeeId;
    row.employeeName = context?.displayName ?? attendance.employeeName;
    const tasks = await TimesheetModel.find({
      loginTime: { $gte: attendance.checkInTime, $lte: attendance.checkOutTime },
      $or: [{ employeeId: { $in: identityTokens } }, { employee: { $in: identityTokens } }],
    })
      .select({ projectId: 1 })
      .sort({ loginTime: 1 })
      .limit(1)
      .lean();
    if (tasks[0]?.projectId) {
      row.projectId = String(tasks[0].projectId);
    }
    rows.push(row);
  }

  return rows;
}
