import { ProjectModel } from '../models/Project';
import { ProjectCellModel } from '../models/ProjectCell';
import { TimesheetModel } from '../models/Timesheet';
import {
  buildAssignedProjectsFilter,
  buildAssignmentIdentityTokens,
  buildCheckInEligibleProjectsFilter,
  ensureAssignedTasksForEmployee,
} from './assignedTaskSync';

export { buildAssignmentIdentityTokens } from './assignedTaskSync';

function computeTotalHours(
  loginTime: Date,
  logoutTime?: Date,
  overriddenHours?: number,
  totalPausedMs = 0,
): number {
  if (overriddenHours !== undefined && overriddenHours !== null) {
    return Number(overriddenHours);
  }
  if (!logoutTime) return 0;
  const diffMs = logoutTime.getTime() - loginTime.getTime() - (totalPausedMs || 0);
  if (diffMs <= 0) return 0;
  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
}

export function toFrontendProject(p: {
  _id: { toString(): string };
  projectName: string;
  clientName: string;
  technologyNode: string;
  accessType: string;
  status: string;
  description?: string;
  allowedUsers?: string[];
  teamLead?: string;
  completedTasks?: number;
  totalTasks?: number;
  completionPercentage?: number;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: p._id.toString(),
    name: p.projectName,
    client: p.clientName,
    technologyNode: p.technologyNode,
    accessType: p.accessType,
    status: p.status,
    description: p.description,
    visibleUsers: p.allowedUsers || [],
    teamLead: p.teamLead || '',
    completedTasks: p.completedTasks ?? 0,
    totalTasks: p.totalTasks ?? 0,
    completionPercentage: p.completionPercentage ?? 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

type AuthUser = { id: string; name: string; email?: string };

/** Projects an employee can open in the layout workspace (broader than timesheet allotment). */
export async function buildEmployeeWorkspaceProjectsFilter(identityTokens: string[]) {
  const filter = await buildCheckInEligibleProjectsFilter(identityTokens);
  return { status: 'Active', ...filter };
}

/** Active projects visible to an employee: all public + privately assigned (team lead, allowedUsers, cell). */
export async function buildEmployeeVisibleProjectsFilter(identityTokens: string[]) {
  const eligible = await buildCheckInEligibleProjectsFilter(identityTokens);
  return { status: 'Active', ...eligible };
}

/** Active projects explicitly allotted to an employee (team lead, allowedUsers, or cell assignment). */
export async function buildAssignedProjectsQueryFilter(identityTokens: string[]) {
  const cellProjectIds = await ProjectCellModel.distinct('projectId', {
    assignedEmployeeId: { $in: identityTokens },
  });

  if (cellProjectIds.length > 0) {
    return {
      status: 'Active',
      $or: [
        ...(buildAssignedProjectsFilter(identityTokens).$or as Record<string, unknown>[]),
        { _id: { $in: cellProjectIds } },
      ],
    };
  }

  return { status: 'Active', ...buildAssignedProjectsFilter(identityTokens) };
}

export async function getAssignedProjectsForUser(
  user: AuthUser,
  employeeRecord?: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    employeeId?: string;
  } | null,
  options?: { syncTasks?: boolean },
) {
  const employeeName = employeeRecord
    ? [employeeRecord.firstName, employeeRecord.middleName, employeeRecord.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() || user.name
    : user.name;

  const assignmentTokens = buildAssignmentIdentityTokens(user, employeeRecord as any);

  const projectFilter = await buildEmployeeVisibleProjectsFilter(assignmentTokens);

  if (options?.syncTasks === true) {
    void ensureAssignedTasksForEmployee({
      id: user.id,
      name: user.name,
      email: user.email,
      employeeId: employeeRecord?.employeeId,
      employeeName,
    }).catch((err) => console.error('Background assigned-task sync failed:', err));
  }

  const assignedProjects = await ProjectModel.find(projectFilter)
    .sort({ createdAt: -1 })
    .lean();

  const projectNames = assignedProjects.map((p) => p.projectName).filter(Boolean);
  const hoursByProjectName: Record<string, number> = {};

  if (projectNames.length > 0) {
    const timesheets = await TimesheetModel.find({
      $or: [
        { employeeId: { $in: assignmentTokens } },
        { employee: { $in: assignmentTokens } },
      ],
      project: { $in: projectNames },
    })
      .select('project loginTime logoutTime overriddenHours totalPausedMs totalHours workedMs')
      .lean();

    timesheets.forEach((t) => {
      const hours =
        typeof t.workedMs === 'number' && t.workedMs > 0
          ? Math.round((t.workedMs / 3600000) * 10) / 10
          : t.totalHours ??
            computeTotalHours(
              t.loginTime,
              t.logoutTime,
              t.overriddenHours,
              t.totalPausedMs,
            );
      const key = t.project || '';
      if (!key) return;
      hoursByProjectName[key] = (hoursByProjectName[key] || 0) + hours;
    });
  }

  return assignedProjects.map((p) => {
    const base = toFrontendProject(p as any);
    let assignmentRole: 'Team Lead' | 'Member' = 'Member';
    if (p.teamLead && assignmentTokens.includes(p.teamLead)) {
      assignmentRole = 'Team Lead';
    }

    return {
      ...base,
      myHours: Math.round((hoursByProjectName[p.projectName] || 0) * 10) / 10,
      assignmentRole,
    };
  });
}

export function sumSessionHours(
  sessions: Array<{
    workedMs?: number;
    totalHours?: number;
    hours?: number;
    loginTime?: Date | string;
    logoutTime?: Date | string;
    overriddenHours?: number;
    totalPausedMs?: number;
    date?: string;
  }>,
): number {
  return sessions.reduce((total, s) => {
    if (typeof s.workedMs === 'number' && s.workedMs >= 0) {
      return total + s.workedMs / 3600000;
    }
    if (s.totalHours != null && Number.isFinite(Number(s.totalHours))) {
      return total + Number(s.totalHours);
    }
    if (s.hours != null && Number.isFinite(Number(s.hours))) {
      return total + Number(s.hours);
    }
    const login = s.loginTime ? new Date(s.loginTime) : null;
    const logout = s.logoutTime ? new Date(s.logoutTime) : null;
    if (login && logout) {
      return total + computeTotalHours(login, logout, s.overriddenHours, s.totalPausedMs);
    }
    return total;
  }, 0);
}

export function toFrontendTimesheetRow(t: {
  _id: { toString(): string };
  loginTime?: Date;
  logoutTime?: Date;
  overriddenHours?: number;
  totalHours?: number;
  workedMs?: number;
  totalPausedMs?: number;
  date?: string;
}) {
  const dateOnly = t.date ?? (t.loginTime ? new Date(t.loginTime).toISOString().split('T')[0] : '');
  const hours =
    typeof t.workedMs === 'number' && t.workedMs >= 0
      ? Math.round((t.workedMs / 3600000) * 100) / 100
      : t.totalHours ??
        (t.loginTime && t.logoutTime
          ? computeTotalHours(t.loginTime, t.logoutTime, t.overriddenHours, t.totalPausedMs)
          : 0);
  return { date: dateOnly, totalHours: hours, hours, workedMs: t.workedMs };
}
