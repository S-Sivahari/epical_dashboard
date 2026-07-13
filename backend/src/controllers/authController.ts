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

      // JWT role is always lowercase 'admin' | 'employee' (normalizeApiRole is applied at token creation)
      const jwtRole = normalizeApiRole(String(req.user.role ?? ''));
      const { name, adminDisplayName, preferredTimezones } = req.body ?? {};
      const wantsDisplayName = adminDisplayName !== undefined || name !== undefined;
      const wantsTimezones = preferredTimezones !== undefined;

      if (!wantsDisplayName && !wantsTimezones) {
        res.status(400).json({ error: 'Nothing to update' });
        return;
      }

      let user = await authService.getUserById(req.user.id);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      if (wantsTimezones) {
        user = await authService.updatePreferredTimezones(req.user.id, preferredTimezones);
      }

      if (wantsDisplayName) {
        if (jwtRole !== 'admin') {
          res.status(403).json({ error: 'Only accessible from the admin portal' });
          return;
        }

        const displayName =
          typeof adminDisplayName === 'string'
            ? adminDisplayName
            : typeof name === 'string'
              ? name
              : '';

        if (!displayName.trim()) {
          res.status(400).json({ error: 'Name is required' });
          return;
        }

        user = await authService.updateAdminDisplayName(req.user.id, displayName);
      }

      const portalAdmin = await authService.resolveSessionPortalAdmin(
        req.user.id,
        req.user.email,
      );

      res.json({
        user,
        role: jwtRole,
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

