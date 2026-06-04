import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import * as employeeService from '../services/employeeService';
import { employeeBelongsToAuthUser } from './employeeAuth';
import { isAdminRole } from './generateToken';

export function rejectUnlessAdmin(req: AuthRequest, res: Response): boolean {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  if (!isAdminRole(req.user.role)) {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
    return false;
  }
  return true;
}

/** Admin: any employee id. Employee: own profile only. */
export async function rejectUnlessAdminOrSelf(
  req: AuthRequest,
  res: Response,
  targetEmployeeId: string,
): Promise<boolean> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  if (isAdminRole(req.user.role)) {
    return true;
  }

  const employee = await employeeService.getEmployeeProfileById(targetEmployeeId);
  if (!employee) {
    res.status(404).json({ error: 'Employee not found' });
    return false;
  }

  const allowed = await employeeBelongsToAuthUser(employee, req.user.id, req.user.email);
  if (!allowed) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}
