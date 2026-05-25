import jwt from 'jsonwebtoken';
import { env } from '../config/env';

/** JWT + requireRole(...) use lowercase (admin | employee); DB may store Admin | Employee */
export function normalizeApiRole(role: string): 'admin' | 'employee' {
  return String(role).trim().toLowerCase() === 'admin' ? 'admin' : 'employee';
}

export function generateToken(payload: {
  id: string;
  email: string;
  role: string;
}): string {
  return jwt.sign(
    { ...payload, role: normalizeApiRole(payload.role) },
    env.jwtSecret,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): { id: string; email: string; role: 'admin' | 'employee' } {
  const decoded = jwt.verify(token, env.jwtSecret) as {
    id: string;
    email: string;
    role: string;
  };
  return {
    ...decoded,
    role: normalizeApiRole(decoded.role),
  };
}
