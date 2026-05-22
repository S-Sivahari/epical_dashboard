import { Types } from 'mongoose';
import { getDB } from '../config/db';
import { ProjectModel } from '../models/Project';
import { AssignedTaskModel } from '../models/AssignedTask';

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
  return `Work on ${projectName}`;
}

async function resolveUserIdForDisplayName(name: string): Promise<string> {
  const db = getDB();
  const trimmed = name.trim();
  const user = await db.collection('users').findOne({ name: trimmed });
  if (user?.id) return String(user.id);

  const employees = await db.collection('employees').find({}).toArray();
  const emp = employees.find((e) => {
    const full = [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ').trim();
    const short = [e.firstName, e.lastName].filter(Boolean).join(' ').trim();
    return full === trimmed || short === trimmed;
  });
  if (emp?.employeeId) return String(emp.employeeId);
  if (emp?._id) return String(emp._id);
  return trimmed;
}

export async function employeeCanAccessProject(
  project: { accessType: string; allowedUsers?: string[]; teamLead?: string },
  identityTokens: string[]
): Promise<boolean> {
  if (project.accessType === 'public') return true;
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
    description: (project.description || '').trim().slice(0, 500) || `Assigned work for ${project.projectName}.`,
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
    ? await db.collection('employees').findOne({ email: employee.email.toLowerCase().trim() })
    : null;

  const identityTokens = buildAssignmentIdentityTokens(employee, employeeRecord);

  const projects = await ProjectModel.find({
    $or: [
      { accessType: 'public' },
      { allowedUsers: { $in: identityTokens } },
      { teamLead: { $in: identityTokens } },
    ],
  });

  for (const project of projects) {
    await ensureAssignedTaskForEmployeeOnProject(project, employee, identityTokens);
  }
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

  if (project.accessType === 'public') {
    return;
  }

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
      description: (project.description || '').trim().slice(0, 500) || `Assigned work for ${project.projectName}.`,
      status: 'assigned',
    });
  }
}
