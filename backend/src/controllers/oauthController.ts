import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { normalizeApiRole } from '../utils/generateToken';
import { setAuthCookies } from '../utils/authCookie';

function oauthFailureRedirect(reason = 'auth_failed') {
  return `${env.FRONTEND_URL}/auth/login?error=${encodeURIComponent(reason)}`;
}

export async function handleGoogleCallback(req: Request, res: Response) {
  try {
    const user = req.user as {
      id: string;
      email: string;
      role: string;
    } | undefined;

    if (!user) {
      return res.redirect(oauthFailureRedirect('google_auth_failed'));
    }

    const apiRole = normalizeApiRole(user.role);
    const token = jwt.sign(
      { id: user.id, email: user.email, role: apiRole },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    setAuthCookies(res, token);
    res.redirect(`${env.FRONTEND_URL}/auth/login?oauth=success`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect(oauthFailureRedirect('auth_failed'));
  }
}
