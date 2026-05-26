import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { getEmployeeDashboardBundle } from '../services/employeeDashboardService';

export const employeeDashboardController = {
  getMine: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const bundle = await getEmployeeDashboardBundle(req.user.id, req.user.email);
      if (!bundle) {
        res.status(404).json({ error: 'Employee dashboard data not found' });
        return;
      }

      res.json(bundle);
    } catch (error) {
      console.error('Error loading employee dashboard:', error);
      res.status(500).json({ error: 'Failed to load dashboard' });
    }
  },
};
