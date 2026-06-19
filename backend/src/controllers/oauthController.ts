import { Request, Response } from 'express';
import { env } from '../config/env';
import { setAuthCookies } from '../utils/authCookie';
import { buildAuthTokenForUser } from '../services/authService';
import { resolveEmployeeForAuthUser } from '../utils/employeeAuth';

function oauthFailureRedirect(reason = 'auth_failed') {
  return `${env.FRONTEND_URL}/auth/login?error=${encodeURIComponent(reason)}`;
}

export async function handleGoogleCallback(req: Request, res: Response) {
  try {
    const user = req.user as {
      id: string;
      email: string;
      role: string;
      portalAdmin?: boolean;
    } | undefined;

    if (!user) {
      return res.redirect(oauthFailureRedirect('google_auth_failed'));
    }

    const employee = await resolveEmployeeForAuthUser(user.id, user.email);
    const token = buildAuthTokenForUser(user, employee);

    setAuthCookies(res, token);
    res.redirect(`${env.FRONTEND_URL}/auth/login?oauth=success`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect(oauthFailureRedirect('auth_failed'));
  }
}
