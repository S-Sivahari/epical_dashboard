import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export function generateToken(payload: {
  id: string;
  email: string;
  role: string;
}): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token: string): { id: string; email: string; role: string } {
  return jwt.verify(token, env.jwtSecret) as { id: string; email: string; role: string };
}
