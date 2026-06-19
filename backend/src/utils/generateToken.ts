import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export type ApiPortalRole = 'admin' | 'employee';

export interface AuthTokenPayload {
  id: string;
  email: string;
  role: ApiPortalRole;
  portalAdmin?: boolean;
}

/** JWT + requireRole(...) use lowercase (admin | employee); DB may store Admin | Employee */
export function normalizeApiRole(role: string): ApiPortalRole {
  return String(role).trim().toLowerCase() === 'admin' ? 'admin' : 'employee';
}

export function hasRole(userRole: string, ...allowedRoles: string[]): boolean {
  const normalized = normalizeApiRole(userRole);
  return allowedRoles.some((r) => normalizeApiRole(r) === normalized);
}

export function isAdminRole(userRole: string): boolean {
  return normalizeApiRole(userRole) === 'admin';
}

export function isEmployeeRole(userRole: string): boolean {
  return normalizeApiRole(userRole) === 'employee';
}

export function generateToken(payload: {
  id: string;
  email: string;
  role: string;
  portalAdmin?: boolean;
}): string {
  const tokenPayload: AuthTokenPayload = {
    id: payload.id,
    email: payload.email,
    role: normalizeApiRole(payload.role),
  };
  if (payload.portalAdmin) {
    tokenPayload.portalAdmin = true;
  }
  return jwt.sign(tokenPayload, env.jwtSecret, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret) as AuthTokenPayload & { role: string };
  return {
    id: decoded.id,
    email: decoded.email,
    role: normalizeApiRole(decoded.role),
    portalAdmin: decoded.portalAdmin === true,
  };
}
