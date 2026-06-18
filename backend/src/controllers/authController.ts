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

      res.json({ user: result.user, role: result.role, portalAdmin: result.portalAdmin });

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

      const portalAdmin = await authService.resolveSessionPortalAdmin(

        req.user.id,

        req.user.email,

      );

      res.json({

        user,

        role: normalizeApiRole(String(req.user.role)),

        portalAdmin,

      });

    } catch {

      res.status(500).json({ error: 'Failed to get user' });

    }

  },



  switchPortal: async (req: AuthRequest, res: Response): Promise<void> => {

    try {

      if (!req.user) {

        res.status(401).json({ error: 'Unauthorized' });

        return;

      }

      const portal = String(req.body?.portal ?? '').trim().toLowerCase();

      if (portal !== 'admin' && portal !== 'employee') {

        res.status(400).json({ error: 'Portal must be admin or employee' });

        return;

      }

      const result = await authService.switchUserPortal(

        req.user.id,

        req.user.email,

        portal,

      );

      setAuthCookies(res, result.token);

      const user = await authService.getUserById(req.user.id);

      res.json({

        user,

        role: result.role,

        portalAdmin: result.portalAdmin,

      });

    } catch (err: any) {

      res.status(err.status || 500).json({ error: err.message || 'Failed to switch portal' });

    }

  },



  updateProfile: async (req: AuthRequest, res: Response): Promise<void> => {

    try {

      if (!req.user) {

        res.status(401).json({ error: 'Unauthorized' });

        return;

      }

      const { name } = req.body ?? {};

      if (typeof name !== 'string') {

        res.status(400).json({ error: 'Name is required' });

        return;

      }

      const user = await authService.updateUserName(req.user.id, name);

      const portalAdmin = await authService.resolveSessionPortalAdmin(

        req.user.id,

        req.user.email,

      );

      res.json({

        user,

        role: normalizeApiRole(String(req.user.role)),

        portalAdmin,

      });

    } catch (err: any) {

      res.status(err.status || 500).json({ error: err.message || 'Failed to update profile' });

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

