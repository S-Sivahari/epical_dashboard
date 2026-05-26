import { Request, Response } from 'express';
import * as leaveService from '../services/leaveService';
import * as notificationService from '../services/notificationService';
import { getDB } from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import type { NotificationType } from '../models/Notification';
import { isAdminRole, isEmployeeRole } from '../utils/generateToken';

/**
 * Sends an in-app notification (+ email via notificationService) to every active employee.
 */
async function notifyAllEmployees(params: {
  type: NotificationType;
  title: string;
  message: string;
  holidayId: string;
  holidayTitle: string;
  holidayDate: string;
  skippedReason?: string;
}): Promise<void> {
  try {
    const employees = await getDB().collection('employees').find({ status: 'Active' }).toArray();
    const relatedData = {
      holidayId: params.holidayId,
      holidayTitle: params.holidayTitle,
      holidayDate: params.holidayDate,
      skippedReason: params.skippedReason,
    };
    await Promise.all(
      employees.map((emp) =>
        notificationService.createNotification({
          recipientId: String(emp.id),
          recipientType: 'Employee',
          type: params.type,
          title: params.title,
          message: params.message,
          relatedData,
        })
      )
    );
  } catch (error) {
    console.error('[Holiday Notification] Failed to notify employees:', error);
  }
}

const VALID_HOLIDAY_TYPES = ['National', 'Company', 'Optional', 'Company Event'] as const;

type HolidayType = (typeof VALID_HOLIDAY_TYPES)[number];

const isValidHolidayType = (value: any): value is HolidayType =>
  VALID_HOLIDAY_TYPES.includes(value);

export const leaveController = {
  // GET /api/leaves
  getAll: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Admins see all; employees see only their own
      const employeeId = isEmployeeRole(req.user?.role ?? '')
          ? (req.query.employeeId as string) || req.user!.id
          : (req.query.employeeId as string) || undefined;
      const leaves = await leaveService.getAllLeaves(employeeId);
      res.json(leaves.filter((l) => l.status !== 'Cancelled'));
    } catch {
      res.status(500).json({ error: 'Failed to fetch leaves' });
    }
  },

  // GET /api/leaves/employee/:employeeId/summary (Admin only)
  getEmployeeSummary: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user || !isAdminRole(req.user.role)) {
        res.status(403).json({ error: 'Forbidden: Admin access required' });
        return;
      }

      const employeeId = Array.isArray(req.params.employeeId)
        ? req.params.employeeId[0]
        : req.params.employeeId;

      if (!employeeId) {
        res.status(400).json({ error: 'employeeId is required' });
        return;
      }

      const summary = await leaveService.getEmployeeLeaveSummary(employeeId);
      res.json(summary);
    } catch {
      res.status(500).json({ error: 'Failed to fetch employee leave summary' });
    }
  },

  // POST /api/leaves
  create: async (req: Request, res: Response): Promise<void> => {
    try {
      const { employeeId, employeeName, type, leaveDuration, halfDaySession, from, to, reason } = req.body;
      if (!employeeId || !type || !leaveDuration || !from || !to) {
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
        reason: typeof reason === 'string' ? reason.trim() : '',
      });
      
      res.status(201).json(leave);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create leave request' });
    }
  },

  // GET /api/leaves/balances
  getBalances: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const employeeId = isEmployeeRole(req.user?.role ?? '')
        ? req.user!.id
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
  approve: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const actionBy = (req.user as any)?.name || (req.user as any)?.email || 'Admin';
      const leave = await leaveService.updateLeaveStatus(id, 'Approved', undefined, actionBy);
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
  reject: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { reason } = req.body;
      const { id } = req.params as { id: string };
      if (!reason || reason.trim() === '') {
        res.status(400).json({ error: 'Rejection reason is required' });
        return;
      }
      const actionBy = (req.user as any)?.name || (req.user as any)?.email || 'Admin';
      const leave = await leaveService.updateLeaveStatus(req.params.id, 'Rejected', reason.trim(), actionBy);
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
  cancel: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const { reason } = req.body;
      const leave = await leaveService.getLeaveById(id);
      if (!leave) {
        res.status(404).json({ error: 'Leave not found' });
        return;
      }
      if (!['Approved', 'Pending'].includes(leave.status)) {
        res.status(400).json({ error: 'Only pending or approved leaves can be cancelled' });
        return;
      }
      const cancelledBy = (req.user as any)?.name || (req.user as any)?.email || undefined;
      const cancelledLeave = await leaveService.cancelLeave(id, reason?.trim(), cancelledBy);
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

  // DELETE /api/leaves/all (Admin only)
  deleteAll: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user || !isAdminRole(req.user.role)) {
        res.status(403).json({ error: 'Forbidden: Admin access required' });
        return;
      }
      const result = await leaveService.deleteAllLeaves();
      res.json({
        message: 'All leave records deleted',
        deletedCount: result.deletedCount,
      });
    } catch (error: unknown) {
      console.error('Error deleting all leaves:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete all leaves',
      });
    }
  },

  // DELETE /api/leaves/:id
  delete: async (req: Request, res: Response): Promise<void> => {
    try {
    const { id } = req.params as { id: string };
    const ok = await leaveService.deleteLeave(id);
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

  // GET /api/leaves/team — returns current-month approved leaves for team visibility
  getTeamLeaves: async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      const allLeaves = await leaveService.getAllLeaves();
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const teamLeaves = allLeaves
        .filter(
          (l) =>
            l.status === 'Approved' &&
            (l.from.startsWith(yearMonth) || l.to.startsWith(yearMonth))
        )
        .map((l) => ({
          id: l.id,
          employeeName: l.employeeName,
          type: l.type,
          from: l.from,
          to: l.to,
          days: l.days,
        }));
      res.json(teamLeaves);
    } catch {
      res.status(500).json({ error: 'Failed to fetch team leaves' });
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

      const holidayType = type || 'National';
      if (!isValidHolidayType(holidayType)) {
        res.status(400).json({ error: 'Invalid holiday type' });
        return;
      }
      const holiday = await leaveService.createHoliday({ title, date, description, type: holidayType });

      // Notify all active employees
      notifyAllEmployees({
        type: 'HolidayAdded',
        title: 'New Holiday Added',
        message: `${title} on ${date} has been added to the company calendar as a ${holidayType} holiday.`,
        holidayId: holiday.id,
        holidayTitle: title,
        holidayDate: date,
      });

      res.status(201).json(holiday);
    } catch {
      res.status(500).json({ error: 'Failed to create holiday' });
    }
  },

  // PUT /api/holidays/:id
  updateHoliday: async (req: Request, res: Response): Promise<void> => {
    try {
      const { title, date, description, type } = req.body;
      const { id } = req.params as { id: string };
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

      const updatedTitle = title || existing.title;
      const updatedDate = date || existing.date;

      // Notify all active employees
      notifyAllEmployees({
        type: 'HolidayUpdated',
        title: 'Holiday Updated',
        message: `The holiday "${updatedTitle}" on ${updatedDate} has been updated in the company calendar.`,
        holidayId: id,
        holidayTitle: updatedTitle,
        holidayDate: updatedDate,
      });

      res.json(holiday);
    } catch {
      res.status(500).json({ error: 'Failed to update holiday' });
    }
  },

  // DELETE /api/holidays/:id
  deleteHoliday: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const holiday = await leaveService.getHolidayById(id);
      if (!holiday) { res.status(404).json({ error: 'Holiday not found' }); return; }

      const ok = await leaveService.deleteHoliday(id);
      if (!ok) { res.status(404).json({ error: 'Holiday not found' }); return; }

      // Notify all active employees
      notifyAllEmployees({
        type: 'HolidayDeleted',
        title: 'Holiday Removed',
        message: `"${holiday.title}" on ${holiday.date} has been removed from the company calendar.`,
        holidayId: id,
        holidayTitle: holiday.title,
        holidayDate: holiday.date,
      });

      res.json({ message: 'Deleted successfully' });
    } catch {
      res.status(500).json({ error: 'Failed to delete holiday' });
    }
  },

  // PATCH /api/holidays/:id/skip
  skipHoliday: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const { reason } = req.body;

      const holiday = await leaveService.getHolidayById(id);
      if (!holiday) { res.status(404).json({ error: 'Holiday not found' }); return; }

      const newSkipped = !holiday.skipped;
      const updated = await leaveService.updateHoliday(id, {
        skipped: newSkipped,
        skippedReason: newSkipped ? (reason?.trim() || 'Marked as working day') : undefined,
      });

      const resolvedReason = newSkipped ? (reason?.trim() || 'Marked as working day') : undefined;

      if (newSkipped) {
        notifyAllEmployees({
          type: 'HolidaySkipped',
          title: 'Holiday Marked as Working Day',
          message: `"${holiday.title}" on ${holiday.date} has been marked as a working day. The company will be operational on this date.`,
          holidayId: id,
          holidayTitle: holiday.title,
          holidayDate: holiday.date,
          skippedReason: resolvedReason,
        });
      } else {
        notifyAllEmployees({
          type: 'HolidayUpdated',
          title: 'Holiday Restored',
          message: `"${holiday.title}" on ${holiday.date} has been restored as a holiday. Enjoy your day off!`,
          holidayId: id,
          holidayTitle: holiday.title,
          holidayDate: holiday.date,
        });
      }

      res.json(updated);
    } catch {
      res.status(500).json({ error: 'Failed to toggle holiday skip status' });
    }
  },
};
