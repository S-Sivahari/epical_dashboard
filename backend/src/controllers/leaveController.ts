import { Request, Response } from 'express';
import * as leaveService from '../services/leaveService';
import { AuthRequest } from '../middleware/authMiddleware';

const VALID_HOLIDAY_TYPES = ['National', 'Company', 'Optional', 'Company Event'] as const;

type HolidayType = (typeof VALID_HOLIDAY_TYPES)[number];

const isValidHolidayType = (value: any): value is HolidayType =>
  VALID_HOLIDAY_TYPES.includes(value);

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
      const { employeeId, employeeName, type, leaveDuration, halfDaySession, from, to, reason } = req.body;
      if (!employeeId || !type || !leaveDuration || !from || !to || !reason) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }
      if (leaveDuration === 'Half Day' && !halfDaySession) {
        res.status(400).json({ error: 'Half-day session is required' });
        return;
      }
      const leave = await leaveService.createLeave({
        employeeId,
        employeeName: employeeName || 'Unknown',
        type,
        leaveDuration,
        halfDaySession,
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
      const { id } = req.params as { id: string };
      const leave = await leaveService.updateLeaveStatus(id, 'Approved');
      if (!leave) {
        res.status(404).json({ error: 'Leave not found' });
        return;
      }
      res.json(leave);
    } catch (error: any) {
      console.error('Error approving leave:', error);
      res.status(400).json({ error: error.message || 'Failed to approve leave' });
    }
  },

  // PATCH /api/leaves/:id/reject
  reject: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const { reason } = req.body;
      if (!reason || reason.trim() === '') {
        res.status(400).json({ error: 'Rejection reason is required' });
        return;
      }
      const leave = await leaveService.updateLeaveStatus(req.params.id, 'Rejected', reason.trim());
      if (!leave) {
        res.status(404).json({ error: 'Leave not found' });
        return;
      }
      res.json(leave);
    } catch (error: any) {
      console.error('Error rejecting leave:', error);
      res.status(400).json({ error: error.message || 'Failed to reject leave' });
    }
  },

  // PATCH /api/leaves/:id/cancel
  cancel: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const leave = await leaveService.getLeaveById(id);
      if (!leave) {
        res.status(404).json({ error: 'Leave not found' });
        return;
      }
      if (leave.status !== 'Approved') {
        res.status(400).json({ error: 'Only approved leaves can be cancelled' });
        return;
      }
      const cancelledLeave = await leaveService.cancelLeave(id);
      if (!cancelledLeave) {
        res.status(500).json({ error: 'Failed to cancel leave' });
        return;
      }
      res.json(cancelledLeave);
    } catch (error: any) {
      console.error('Error cancelling leave:', error);
      res.status(500).json({ error: error.message || 'Failed to cancel leave' });
    }
  },

  // DELETE /api/leaves/:id
  delete: async (req: Request, res: Response): Promise<void> => {
    try {
      const ok = await leaveService.deleteLeave(req.params.id);
      if (!ok) {
        res.status(404).json({ error: 'Leave not found' });
        return;
      }
      res.json({ message: 'Deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting leave:', error);
      res.status(500).json({ error: error.message || 'Failed to delete leave' });
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

      const holidayType = type || 'National';
      if (!isValidHolidayType(holidayType)) {
        res.status(400).json({ error: 'Invalid holiday type' });
        return;
      }
      const holiday = await leaveService.createHoliday({ title, date, description, type: holidayType });
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

      if (type && !isValidHolidayType(type)) {
        res.status(400).json({ error: 'Invalid holiday type' });
        return;
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
      const { id } = req.params as { id: string };
      const ok = await leaveService.deleteHoliday(id);
      if (!ok) { res.status(404).json({ error: 'Holiday not found' }); return; }
      res.json({ message: 'Deleted successfully' });
    } catch {
      res.status(500).json({ error: 'Failed to delete holiday' });
    }
  },
};
