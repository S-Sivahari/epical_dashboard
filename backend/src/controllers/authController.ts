import { Request, Response } from 'express';
import * as authService from '../services/authService';
import { AuthRequest } from '../middleware/authMiddleware';
import { env } from '../config/env';
import { clearAuthCookies, setAuthCookies } from '../utils/authCookie';
import { normalizeApiRole } from '../utils/generateToken';

export const authController = {
  login: async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }
      const result = await authService.loginUser(email, password);
      setAuthCookies(res, result.token);
      res.json({ user: result.user, role: result.role });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Login failed' });
    }
  },

  logout: async (_req: Request, res: Response): Promise<void> => {
    clearAuthCookies(res);
    res.json({ ok: true });
  },

  me: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const user = await authService.getUserById(req.user.id);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({
        user,
        role: normalizeApiRole(String(user.role)),
      });
    } catch {
      res.status(500).json({ error: 'Failed to get user' });
    }
  },

  seed: async (req: Request, res: Response): Promise<void> => {
    if (env.nodeEnv === 'production') {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    try {
      const result = await authService.seedDefaultUsers();
      res.json({ message: 'Seed complete', ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Seeding failed' });
    }
  },
};
