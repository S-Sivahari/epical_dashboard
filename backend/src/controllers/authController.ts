import { Request, Response } from 'express';
import * as authService from '../services/authService';
import { AuthRequest } from '../middleware/authMiddleware';

export const authController = {
  login: async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }
      const result = await authService.loginUser(email, password);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message || 'Login failed' });
    }
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
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to get user' });
    }
  },

  seed: async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await authService.seedDefaultUsers();
      res.json({ message: 'Seed complete', ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Seeding failed' });
    }
  },
};
