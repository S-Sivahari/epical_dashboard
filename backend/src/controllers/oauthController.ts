import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { getDB } from '../config/db';
import bcrypt from 'bcryptjs';

export async function handleGoogleCallback(req: Request, res: Response) {
  try {
    const user = req.user as any;

    if (!user) {
      return res.status(401).json({ message: 'Authentication failed' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    // Return token and redirect to frontend
    const role = user.role === 'Admin' ? 'admin' : 'employee';
    const redirectUrl = `${env.FRONTEND_URL}?token=${token}&role=${role}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect(`${env.FRONTEND_URL}?error=auth_failed`);
  }
}

export async function loginWithOAuth(req: Request, res: Response) {
  try {
    const { email, name, googleId } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const userCollection = getDB().collection('users');
    const normalizedEmail = email.toLowerCase().trim();

    // Try to find existing user
    let user = await userCollection.findOne({ email: normalizedEmail });

    if (!user) {
      // Auto-create user from Google profile
      const newUser = {
        id: `EMP-${Date.now()}`,
        email: normalizedEmail,
        name: name || email.split('@')[0],
        googleId,
        passwordHash: await bcrypt.hash('', 10), // Empty password hash for OAuth users
        role: 'Employee',
        department: 'General',
        designation: 'Employee',
        joinedAt: new Date().toISOString().split('T')[0],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = await userCollection.insertOne(newUser);
      user = { ...newUser, _id: result.insertedId };
      console.log(`[OAuth] Created new user: ${normalizedEmail}`);
    } else if (!user.googleId) {
      // Link Google ID to existing user
      await userCollection.updateOne(
        { _id: user._id },
        { $set: { googleId, updatedAt: new Date() } }
      );
      user.googleId = googleId;
      console.log(`[OAuth] Linked Google ID to existing user: ${normalizedEmail}`);
    } else {
      console.log(`[OAuth] User already has Google ID: ${normalizedEmail}`);
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    const mappedRole = user.role === 'Admin' ? 'admin' : 'employee';

    console.log(`[OAuth] Successfully logged in: ${normalizedEmail} as ${mappedRole}`);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation,
        joinedAt: user.joinedAt,
      },
      role: mappedRole,
    });
  } catch (error) {
    console.error('[OAuth] Login error:', error);
    res.status(500).json({ message: 'OAuth login failed', error: String(error) });
  }
}

