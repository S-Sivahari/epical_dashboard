import { Request } from 'express';
import { Types } from 'mongoose';
import { getDB } from '../config/db';
import { ProjectModel } from '../models/Project';
import { ProjectCellModel } from '../models/ProjectCell';
import { buildAssignmentIdentityTokens } from './assignedTaskSync';
import { isAdminRole } from './generateToken';

function actorFromReq(req: Request) {
  const user = (req as Request & { user?: { id?: string; email?: string; name?: string } }).user;
  return {
    userId: user?.id || user?._id?.toString() || '',
    userName: user?.name || user?.email || 'User',
    email: user?.email || '',
  };
}

async function resolveEmployeeRecord(userId: string) {
  const db = getDB();
  return db.collection('employees').findOne(
    { $or: [{ id: userId }, { employeeId: userId }] },
    { projection: { id: 1, employeeId: 1, firstName: 1, middleName: 1, lastName: 1, email: 1 } },
  );
}

export async function getAssignmentTokensFromRequest(req: Request): Promise<string[]> {
  const actor = actorFromReq(req);
  const employee = await resolveEmployeeRecord(actor.userId);
  return buildAssignmentIdentityTokens(actor, employee as Parameters<typeof buildAssignmentIdentityTokens>[1]);
}

export async function assertProjectAccessById(projectId: string, tokens: string[]) {
  if (!Types.ObjectId.isValid(projectId)) return null;
  const project = await ProjectModel.findById(projectId);
  if (!project) return null;

  const hasMembership =
    project.accessType === 'public' ||
    tokens.includes(project.teamLead || '') ||
    (project.allowedUsers || []).some((u: string) => tokens.includes(u));

  if (hasMembership) return project;

  const hasAssignedCells = await ProjectCellModel.exists({
    projectId: project._id,
    assignedEmployeeId: { $in: tokens },
  });

  return hasAssignedCells ? project : null;
}

export async function assertProjectForRequest(req: Request, projectId: string) {
  if (!Types.ObjectId.isValid(projectId)) return null;
  const project = await ProjectModel.findById(projectId);
  if (!project) return null;

  const user = (req as Request & { user?: { role?: string } }).user;
  if (user?.role && isAdminRole(user.role)) return project;

  const tokens = await getAssignmentTokensFromRequest(req);
  return assertProjectAccessById(projectId, tokens);
}
