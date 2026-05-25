import { Request, Response, NextFunction } from 'express';
import { hasRole } from '../utils/generateToken';
import { AuthRequest } from './authMiddleware';

export function roleMiddleware(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!hasRole(req.user.role, ...roles)) {
      res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      return;
    }
    next();
  };
}
