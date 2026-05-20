import { Request, Response } from 'express';
import * as leaveService from '../services/leaveService';
import { AuthRequest } from '../middleware/authMiddleware';

export const leaveController = {
  // GET /api/leaves
  getAll: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Admins see all; employees see only their own
      const employeeId =
        req.user?.role === 'Employee'
          ? (req.query.employeeId as string) || req.user.id
          : (req.query.employeeId as string) || undefined;
      const leaves = await leaveService.getAllLeaves(employeeId);
      res.json(leaves);
    } catch {
      res.status(500).json({ error: 'Failed to fetch leaves' });
    }
  },

  // POST /api/leaves
  create: async (req: Request, res: Response): Promise<void> => {
    try {
      const { employeeId, employeeName, type, from, to, reason } = req.body;
      if (!employeeId || !type || !from || !to || !reason) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }
      const leave = await leaveService.createLeave({
        employeeId,
        employeeName: employeeName || 'Unknown',
        type,
        from,
        to,
        days: 0, // days will be overridden by backend calculation
        reason,
      });
      res.status(201).json(leave);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create leave request' });
    }
  },

  // GET /api/leaves/balances
  getBalances: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const employeeId = req.user?.role === 'Employee'
        ? req.user.id
        : (req.query.employeeId as string);
        
      if (!employeeId) {
        res.status(400).json({ error: 'employeeId is required' });
        return;
      }
      
      const balances = await leaveService.getLeaveBalances(employeeId);
      res.json(balances);
    } catch {
      res.status(500).json({ error: 'Failed to fetch leave balances' });
    }
  },

  // PATCH /api/leaves/:id/approve
  approve: async (req: Request, res: Response): Promise<void> => {
    try {
      const leave = await leaveService.updateLeaveStatus(req.params.id, 'Approved');
      if (!leave) { res.status(404).json({ error: 'Leave not found' }); return; }
      res.json(leave);
    } catch {
      res.status(500).json({ error: 'Failed to approve leave' });
    }
  },

  // PATCH /api/leaves/:id/reject
  reject: async (req: Request, res: Response): Promise<void> => {
    try {
      const leave = await leaveService.updateLeaveStatus(req.params.id, 'Rejected');
      if (!leave) { res.status(404).json({ error: 'Leave not found' }); return; }
      res.json(leave);
    } catch {
      res.status(500).json({ error: 'Failed to reject leave' });
    }
  },

  // PATCH /api/leaves/:id/cancel
  cancel: async (req: Request, res: Response): Promise<void> => {
    try {
      const leave = await leaveService.getLeaveById(req.params.id);
      if (!leave) {
        res.status(404).json({ error: 'Leave not found' });
        return;
      }
      if (leave.status !== 'Approved') {
        res.status(400).json({ error: 'Only approved leaves can be cancelled' });
        return;
      }
      const cancelledLeave = await leaveService.cancelLeave(req.params.id);
      if (!cancelledLeave) {
        res.status(500).json({ error: 'Failed to cancel leave' });
        return;
      }
      res.json(cancelledLeave);
    } catch {
      res.status(500).json({ error: 'Failed to cancel leave' });
    }
  },

  // DELETE /api/leaves/:id
  delete: async (req: Request, res: Response): Promise<void> => {
    try {
      const ok = await leaveService.deleteLeave(req.params.id);
      if (!ok) { res.status(404).json({ error: 'Leave not found' }); return; }
      res.json({ message: 'Deleted successfully' });
    } catch {
      res.status(500).json({ error: 'Failed to delete leave' });
    }
  },

  // GET /api/holidays
  getHolidays: async (_req: Request, res: Response): Promise<void> => {
    try {
      const holidays = await leaveService.getAllHolidays();
      res.json(holidays);
    } catch {
      res.status(500).json({ error: 'Failed to fetch holidays' });
    }
  },

  // POST /api/holidays
  createHoliday: async (req: Request, res: Response): Promise<void> => {
    try {
      const { title, date, description, type } = req.body;
      if (!title || !date) { res.status(400).json({ error: 'title and date required' }); return; }
      
      // Check for duplicate holiday on the same date
      const isDuplicate = await leaveService.checkDuplicateHoliday(date);
      if (isDuplicate) { res.status(409).json({ error: 'Holiday already exists on this date' }); return; }
      
      const holiday = await leaveService.createHoliday({ title, date, description, type: type || 'National' });
      res.status(201).json(holiday);
    } catch {
      res.status(500).json({ error: 'Failed to create holiday' });
    }
  },

  // PUT /api/holidays/:id
  updateHoliday: async (req: Request, res: Response): Promise<void> => {
    try {
      const { title, date, description, type } = req.body;
      const id = req.params.id;
      
      const existing = await leaveService.getHolidayById(id);
      if (!existing) { res.status(404).json({ error: 'Holiday not found' }); return; }
      
      // Check for duplicate holiday on the same date (if date changed)
      if (date && date !== existing.date) {
        const isDuplicate = await leaveService.checkDuplicateHoliday(date, id);
        if (isDuplicate) { res.status(409).json({ error: 'Holiday already exists on this date' }); return; }
      }
      
      const holiday = await leaveService.updateHoliday(id, { title, date, description, type });
      res.json(holiday);
    } catch {
      res.status(500).json({ error: 'Failed to update holiday' });
    }
  },

  // DELETE /api/holidays/:id
  deleteHoliday: async (req: Request, res: Response): Promise<void> => {
    try {
      const ok = await leaveService.deleteHoliday(req.params.id);
      if (!ok) { res.status(404).json({ error: 'Holiday not found' }); return; }
      res.json({ message: 'Deleted successfully' });
    } catch {
      res.status(500).json({ error: 'Failed to delete holiday' });
    }
  },
};
