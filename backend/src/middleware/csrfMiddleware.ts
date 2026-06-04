import { Request, Response, NextFunction } from 'express';
import { CSRF_COOKIE_NAME } from '../utils/authCookie';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const CSRF_EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/seed',
  '/api/auth/google',
  '/health',
];

function isExempt(path: string): boolean {
  return CSRF_EXEMPT_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const path = req.path;
  if (isExempt(path)) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers['x-csrf-token'];
  if (
    typeof cookieToken === 'string' &&
    typeof headerToken === 'string' &&
    cookieToken.length > 0 &&
    cookieToken === headerToken
  ) {
    next();
    return;
  }

  res.status(403).json({ error: 'Invalid or missing CSRF token' });
}
