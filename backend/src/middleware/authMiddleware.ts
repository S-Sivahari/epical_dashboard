import { Request, Response, NextFunction } from 'express';
import { hasRole, verifyToken } from '../utils/generateToken';
import { readAuthTokenFromRequest } from '../utils/authCookie';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: string;
    }
    interface Request {
      user?: User;
    }
  }
}

export type AuthRequest = Request;

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = readAuthTokenFromRequest(req);

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: No session' });
    return;
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
  }
}

export function requireRole(...roles: string[]) {
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
