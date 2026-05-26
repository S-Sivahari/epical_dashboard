import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { normalizeApiRole } from '../utils/generateToken';
import { getDB } from '../config/db';
import {
  ensureUserAccountForEmployee,
  normalizeLoginEmail,
  resolveUserForOAuthLogin,
} from '../utils/employeeAuth';

function oauthFailureRedirect(reason = 'auth_failed') {
  return `${env.FRONTEND_URL}/auth/login?error=${encodeURIComponent(reason)}`;
}

export async function handleGoogleCallback(req: Request, res: Response) {
  try {
    const user = req.user as any;

    if (!user) {
      return res.redirect(oauthFailureRedirect('google_auth_failed'));
    }

    const apiRole = normalizeApiRole(user.role);
    const token = jwt.sign(
      { id: user.id, email: user.email, role: apiRole },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any },
    );

    const params = new URLSearchParams({
      token,
      role: apiRole,
      email: user.email ?? '',
      name: user.name ?? '',
      designation: user.designation ?? 'Employee',
    });

    res.redirect(`${env.FRONTEND_URL}/auth/login?${params.toString()}`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect(oauthFailureRedirect('auth_failed'));
  }
}

export async function loginWithOAuth(req: Request, res: Response) {
  try {
    const { email, name, googleId } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const normalizedEmail = normalizeLoginEmail(email);
    const { user: existingUser, employee } = await resolveUserForOAuthLogin(normalizedEmail);

    if (!employee && !existingUser) {
      return res.status(401).json({
        message: 'This email is not registered. Use admin@company.com for admin access or contact HR for employee registration.',
      });
    }

    const userCollection = getDB().collection('users');
    let user = existingUser;

    if (!user && employee) {
      user = await ensureUserAccountForEmployee(employee as any, '');
    }

    if (!user) {
      return res.status(401).json({ message: 'Unable to sign in with this email.' });
    }

    if (!user.passwordHash) {
      await userCollection.updateOne(
        { _id: user._id },
        { $set: { passwordHash: await bcrypt.hash('', 10), updatedAt: new Date() } },
      );
    }

    if (googleId) {
      if (!user.googleId) {
        await userCollection.updateOne(
          { _id: user._id },
          { $set: { googleId, updatedAt: new Date() } },
        );
        user.googleId = googleId;
      }
    }

    const displayName =
      employee
        ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim()
        : user.name || name || normalizedEmail.split('@')[0];

    const apiRole = normalizeApiRole(user.role);
    const token = jwt.sign(
      { id: user.id, email: normalizedEmail, role: apiRole },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: displayName,
        email: normalizedEmail,
        role: user.role,
        designation: user.designation || employee?.designation || 'Employee',
        joinedAt: user.joinedAt || employee?.joinedAt,
      },
      role: apiRole,
    });
  } catch (error) {
    console.error('[OAuth] Login error:', error);
    res.status(500).json({ message: 'OAuth login failed', error: String(error) });
  }
}
