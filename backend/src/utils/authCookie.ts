import { randomBytes } from 'crypto';
import type { CookieOptions, Response } from 'express';
import { env } from '../config/env';

export const AUTH_COOKIE_NAME = 'hrms_auth';
export const CSRF_COOKIE_NAME = 'hrms_csrf';

function getApiOrigin(): string {
  try {
    const callback = new URL(env.GOOGLE_CALLBACK_URL);
    return `${callback.protocol}//${callback.host}`;
  } catch {
    return `http://localhost:${env.port}`;
  }
}

function isCrossOriginFrontend(): boolean {
  try {
    return new URL(env.FRONTEND_URL).origin !== getApiOrigin();
  } catch {
    return false;
  }
}

function cookieMaxAgeMs(): number {
  const raw = env.JWT_EXPIRES_IN.trim();
  const match = /^(\d+)([dhms])$/i.exec(raw);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return n * (multipliers[unit] ?? multipliers.d);
}

export function getBaseCookieOptions(): CookieOptions {
  const isProd = env.nodeEnv === 'production';
  const crossOrigin = isCrossOriginFrontend();
  const sameSite: CookieOptions['sameSite'] = crossOrigin ? 'none' : 'lax';

  return {
    httpOnly: true,
    secure: isProd || crossOrigin,
    sameSite,
    path: '/',
    maxAge: cookieMaxAgeMs(),
  };
}

export function setAuthCookies(res: Response, token: string): void {
  const base = getBaseCookieOptions();
  res.cookie(AUTH_COOKIE_NAME, token, { ...base, httpOnly: true });

  const csrf = randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE_NAME, csrf, { ...base, httpOnly: false });
}

export function clearAuthCookies(res: Response): void {
  const base = getBaseCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, { ...base, httpOnly: true });
  res.clearCookie(CSRF_COOKIE_NAME, { ...base, httpOnly: false });
}

export function readAuthTokenFromRequest(req: {
  cookies?: Record<string, string | undefined>;
  headers?: { authorization?: string };
}): string | undefined {
  const fromCookie = req.cookies?.[AUTH_COOKIE_NAME];
  if (fromCookie) return fromCookie;

  const authHeader = req.headers?.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return undefined;
}
