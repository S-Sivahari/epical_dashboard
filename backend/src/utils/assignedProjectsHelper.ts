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

function computeTotalHours(loginTime: Date, logoutTime?: Date, overriddenHours?: number): number {
  if (overriddenHours !== undefined && overriddenHours !== null) {
    return Number(overriddenHours);
  }
  if (!logoutTime) return 0;
  const diffMs = logoutTime.getTime() - loginTime.getTime();
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

  const cellProjectIds = await ProjectCellModel.distinct('projectId', {
    assignedEmployeeId: { $in: assignmentTokens },
  });

  const projectFilter =
    cellProjectIds.length > 0
      ? {
          status: 'Active',
          $or: [
            ...(buildAssignedProjectsFilter(assignmentTokens).$or as Record<string, unknown>[]),
            { _id: { $in: cellProjectIds } },
          ],
        }
      : { status: 'Active', ...buildAssignedProjectsFilter(assignmentTokens) };

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
      $or: [{ employeeId: user.id }, { employee: employeeName }],
      project: { $in: projectNames },
    })
      .select('project loginTime logoutTime overriddenHours')
      .lean();

    timesheets.forEach((t) => {
      const hours = computeTotalHours(t.loginTime, t.logoutTime, t.overriddenHours);
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
  sessions: Array<{ totalHours?: number; hours?: number; loginTime?: Date | string; logoutTime?: Date | string; overriddenHours?: number; date?: string }>,
): number {
  return sessions.reduce((total, s) => {
    if (s.totalHours != null && Number.isFinite(Number(s.totalHours))) {
      return total + Number(s.totalHours);
    }
    if (s.hours != null && Number.isFinite(Number(s.hours))) {
      return total + Number(s.hours);
    }
    const login = s.loginTime ? new Date(s.loginTime) : null;
    const logout = s.logoutTime ? new Date(s.logoutTime) : null;
    if (login && logout) {
      return total + computeTotalHours(login, logout, s.overriddenHours);
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
  date?: string;
}) {
  const dateOnly = t.date ?? (t.loginTime ? new Date(t.loginTime).toISOString().split('T')[0] : '');
  const hours =
    t.totalHours ??
    (t.loginTime && t.logoutTime
      ? computeTotalHours(t.loginTime, t.logoutTime, t.overriddenHours)
      : 0);
  return { date: dateOnly, totalHours: hours, hours };
}
