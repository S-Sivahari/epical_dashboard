import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';
import { TimesheetModel } from '../models/Timesheet';
import { computeWorkedMs } from '../utils/durationFormat';
import { getAttendanceSessionWorkedMs } from './workSessionService';

export type ProjectWiseHoursRow = {
  projectId: string;
  project: string;
  hours: number;
  sessions: number;
};

type ProjectGrossRow = {
  projectId: string;
  project: string;
  grossMs: number;
};

async function loadProjectGrossInSession(
  attendance: {
    employeeId: string;
    employeeName: string;
    checkInTime: Date;
    checkOutTime: Date;
  },
  identityTokens: string[],
): Promise<ProjectGrossRow[]> {
  const tokens = Array.from(
    new Set(
      [...identityTokens, attendance.employeeId, attendance.employeeName]
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  );
  if (tokens.length === 0) return [];

  const checkInTime = new Date(attendance.checkInTime);
  const checkOutTime = new Date(attendance.checkOutTime);

  const tasks = await TimesheetModel.find({
    $and: [
      {
        $or: [{ employeeId: { $in: tokens } }, { employee: { $in: tokens } }],
      },
      { loginTime: { $gte: checkInTime, $lte: checkOutTime } },
      {
        $or: [
          { logoutTime: { $gte: checkInTime } },
          { logoutTime: { $exists: false } },
          { logoutTime: null },
        ],
      },
    ],
  })
    .select({ projectId: 1, project: 1, loginTime: 1, logoutTime: 1, totalPausedMs: 1 })
    .sort({ loginTime: 1 })
    .lean();

  const byProject = new Map<string, ProjectGrossRow>();

  for (const task of tasks) {
    const projectId = task.projectId ? String(task.projectId) : '';
    const project = String(task.project || '').trim() || 'Unknown';
    const key = projectId || project;
    const logout = task.logoutTime ? new Date(task.logoutTime) : checkOutTime;
    const grossMs = computeWorkedMs(
      new Date(task.loginTime),
      logout,
      task.totalPausedMs || 0,
    );

    const existing = byProject.get(key);
    if (existing) {
      existing.grossMs += grossMs;
    } else {
      byProject.set(key, { projectId, project, grossMs });
    }
  }

  return [...byProject.values()];
}

function creditSessionWorkedToProjects(
  sessionWorkedMs: number,
  projectRows: ProjectGrossRow[],
  byProjectId: Map<string, { project: string; hours: number; sessions: number }>,
) {
  if (projectRows.length === 0 || sessionWorkedMs <= 0) return;

  const totalGross = projectRows.reduce((sum, row) => sum + row.grossMs, 0);
  let assigned = 0;

  for (let index = 0; index < projectRows.length; index += 1) {
    const row = projectRows[index];
    const isLast = index === projectRows.length - 1;
    const key = row.projectId || row.project;

    let share = 0;
    if (projectRows.length === 1) {
      share = sessionWorkedMs;
    } else if (totalGross > 0) {
      share = isLast
        ? Math.max(0, sessionWorkedMs - assigned)
        : Math.floor((sessionWorkedMs * row.grossMs) / totalGross);
      if (!isLast) assigned += share;
    }

    if (share <= 0) continue;

    const hours = share / 3600000;
    const existing = byProjectId.get(key);
    if (existing) {
      existing.hours += hours;
      existing.sessions += 1;
    } else {
      byProjectId.set(key, {
        project: row.project,
        hours,
        sessions: 1,
      });
    }
  }
}

/** Sum session worked time (same as work history) per project across attendance sessions. */
export async function aggregateProjectWiseHoursForEmployee(
  employeeId: string,
  identityTokens: string[],
  from: string,
  to: string,
): Promise<ProjectWiseHoursRow[]> {
  const loginFrom = new Date(`${from}T00:00:00.000Z`);
  const loginTo = new Date(`${to}T23:59:59.999Z`);

  const attendances = await EmployeeAttendanceModel.find({
    employeeId,
    checkInTime: { $gte: loginFrom, $lte: loginTo },
    checkOutTime: { $ne: null },
  })
    .select({
      employeeId: 1,
      employeeName: 1,
      checkInTime: 1,
      checkOutTime: 1,
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
    .sort({ checkInTime: 1 })
    .lean();

  const byProjectId = new Map<string, { project: string; hours: number; sessions: number }>();

  for (const attendance of attendances) {
    if (!attendance.checkOutTime) continue;

    const sessionWorkedMs = getAttendanceSessionWorkedMs(attendance);
    const projectRows = await loadProjectGrossInSession(
      {
        employeeId: attendance.employeeId,
        employeeName: attendance.employeeName,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
      },
      identityTokens,
    );

    creditSessionWorkedToProjects(sessionWorkedMs, projectRows, byProjectId);
  }

  return [...byProjectId.entries()]
    .map(([projectId, row]) => ({
      projectId: projectId || '',
      project: row.project,
      hours: Math.round(row.hours * 10) / 10,
      sessions: row.sessions,
    }))
    .sort((a, b) => b.hours - a.hours || a.project.localeCompare(b.project));
}
