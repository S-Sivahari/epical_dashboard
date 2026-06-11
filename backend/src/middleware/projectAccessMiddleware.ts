import { NextFunction, Response } from 'express';
import { isAdminRole } from '../utils/generateToken';
import { assertProjectForRequest } from '../utils/projectAccessHelper';
import type { AuthRequest } from './authMiddleware';

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export async function requireProjectAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const projectId = paramId(req.params.projectId);
  if (!projectId) {
    next();
    return;
  }

  if (req.user?.role && isAdminRole(req.user.role)) {
    next();
    return;
  }

  const project = await assertProjectForRequest(req, projectId);
  if (!project) {
    res.status(403).json({ error: 'Project not found or access denied' });
    return;
  }

  next();
}
