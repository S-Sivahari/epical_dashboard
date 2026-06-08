import { Types } from 'mongoose';
import { getDB } from '../config/db';
import { ProjectModel } from '../models/Project';
import { AssignedTaskModel } from '../models/AssignedTask';
import { normalizeProjectDescription } from './textLimits';

export function buildAssignmentIdentityTokens(
  user: { id?: string; name?: string; email?: string; employeeId?: string },
  employeeRecord?: {
    id?: string;
    employeeId?: string;
    email?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
  } | null
): string[] {
  const tokens = new Set<string>();
  const add = (value?: string | null) => {
    const trimmed = value?.trim();
    if (trimmed) tokens.add(trimmed);
  };

  add(user.id);
  add(user.name);
  add(user.email);
  add(user.employeeId);

  add(employeeRecord?.id);
  add(employeeRecord?.employeeId);
  add(employeeRecord?.email);

  const fullName = [employeeRecord?.firstName, employeeRecord?.middleName, employeeRecord?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  add(fullName);
  add([employeeRecord?.firstName, employeeRecord?.lastName].filter(Boolean).join(' ').trim());

  return Array.from(tokens);
}

function defaultTaskTitle(projectName: string): string {
  return projectName;
}

async function resolveUserIdForDisplayName(name: string): Promise<string> {
  const db = getDB();
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const user = await db.collection('users').findOne({ name: trimmed });
  if (user?.id) return String(user.id);

  const parts = trimmed.split(/\s+/).filter(Boolean);
  const employeeQuery =
    parts.length >= 2
      ? {
          $or: [
            {
              $expr: {
                $eq: [
                  {
                    $trim: {
                      input: {
                        $concat: [
                          { $ifNull: ['$firstName', ''] },
                          ' ',
                          { $ifNull: ['$middleName', ''] },
                          ' ',
                          { $ifNull: ['$lastName', ''] },
                        ],
                      },
                    },
                  },
                  trimmed,
                ],
              },
            },
            {
              $expr: {
                $eq: [
                  {
                    $trim: {
                      input: {
                        $concat: [
                          { $ifNull: ['$firstName', ''] },
                          ' ',
                          { $ifNull: ['$lastName', ''] },
                        ],
                      },
                    },
                  },
                  trimmed,
                ],
              },
            },
          ],
        }
      : { firstName: trimmed };

  const emp = await db.collection('employees').findOne(employeeQuery, { projection: { documents: 0, 'photo.data': 0 } });
  if (emp?.employeeId) return String(emp.employeeId);
  if (emp?.id) return String(emp.id);
  if (emp?._id) return String(emp._id);
  return trimmed;
}

/** Projects visible to an employee — allotted via team lead or allowedUsers (public and private). */
export function buildAssignedProjectsFilter(identityTokens: string[]) {
  return {
    $or: [
      { allowedUsers: { $in: identityTokens } },
      { teamLead: { $in: identityTokens } },
    ],
  };
}

export async function employeeCanAccessProject(
  project: { accessType: string; allowedUsers?: string[]; teamLead?: string },
  identityTokens: string[]
): Promise<boolean> {
  if (project.teamLead && identityTokens.includes(project.teamLead)) return true;
  return (project.allowedUsers || []).some((u) => identityTokens.includes(u));
}

export async function ensureAssignedTaskForEmployeeOnProject(
  project: {
    _id: Types.ObjectId;
    projectName: string;
    clientName: string;
    technologyNode: string;
    description?: string;
    accessType: string;
    allowedUsers?: string[];
    teamLead?: string;
  },
  employee: { id: string; name: string },
  identityTokens: string[]
): Promise<void> {
  const canAccess = await employeeCanAccessProject(project, identityTokens);
  if (!canAccess) return;

  const title = defaultTaskTitle(project.projectName);

  const existing = await AssignedTaskModel.findOne({
    projectId: project._id,
    title,
    $or: [{ employeeId: { $in: identityTokens } }, { employeeName: { $in: identityTokens } }],
    status: { $in: ['assigned', 'in_progress', 'pending_review', 'completed'] },
  });

  if (existing) return;

  await AssignedTaskModel.create({
    projectId: project._id,
    projectName: project.projectName,
    clientName: project.clientName,
    technologyNode: project.technologyNode,
    employeeId: employee.id,
    employeeName: employee.name,
    title,
    description:
      normalizeProjectDescription(project.description || '') ||
      `Assigned work for ${project.projectName}.`,
    status: 'assigned',
  });
}

export async function ensureAssignedTasksForEmployee(employee: {
  id: string;
  name: string;
  email?: string;
  employeeName?: string;
  employeeId?: string;
}): Promise<void> {
  const db = getDB();
  const employeeRecord = employee.email
    ? await db.collection('employees').findOne(
        { email: employee.email.toLowerCase().trim() },
        { projection: { documents: 0, 'photo.data': 0 } }
      )
    : null;

  const identityTokens = buildAssignmentIdentityTokens(employee, employeeRecord as any);

  const projects = await ProjectModel.find(buildAssignedProjectsFilter(identityTokens)).lean();

  if (projects.length === 0) return;

  await Promise.all(
    projects.map((project) =>
      ensureAssignedTaskForEmployeeOnProject(project as any, employee, identityTokens),
    ),
  );
}

/** Create/update assigned tasks for everyone listed on a private project. */
export async function syncAssignedTasksForProject(project: {
  _id: Types.ObjectId;
  projectName: string;
  clientName: string;
  technologyNode: string;
  description?: string;
  accessType: string;
  allowedUsers?: string[];
  teamLead?: string;
}): Promise<void> {
  const assigneeNames = new Set<string>();
  if (project.teamLead?.trim()) assigneeNames.add(project.teamLead.trim());
  (project.allowedUsers || []).forEach((n) => {
    if (n?.trim()) assigneeNames.add(n.trim());
  });

  const title = defaultTaskTitle(project.projectName);

  for (const name of assigneeNames) {
    const employeeId = await resolveUserIdForDisplayName(name);
    const existing = await AssignedTaskModel.findOne({
      projectId: project._id,
      title,
      $or: [{ employeeId }, { employeeName: name }],
      status: { $in: ['assigned', 'in_progress', 'pending_review', 'completed'] },
    });

    if (existing) {
      if (existing.employeeName !== name || existing.employeeId !== employeeId) {
        existing.employeeName = name;
        existing.employeeId = employeeId;
        await existing.save();
      }
      continue;
    }

    await AssignedTaskModel.create({
      projectId: project._id,
      projectName: project.projectName,
      clientName: project.clientName,
      technologyNode: project.technologyNode,
      employeeId,
      employeeName: name,
      title,
      description:
      normalizeProjectDescription(project.description || '') ||
      `Assigned work for ${project.projectName}.`,
      status: 'assigned',
    });
  }
}
