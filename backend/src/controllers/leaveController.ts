import { Request, Response } from 'express';
import * as leaveService from '../services/leaveService';
import * as notificationService from '../services/notificationService';
import { AuthRequest } from '../middleware/authMiddleware';
import { isAdminRole, isEmployeeRole } from '../utils/generateToken';
import { resolveEmployeeForAuthUser } from '../utils/employeeAuth';
import {
  buildHolidayImportTemplate,
  expandHolidayDates,
  formatHolidaySummaryDate,
  holidayTypeToLabel,
  parseHolidayImportWorkbook,
} from '../utils/holidayImportExcel';

const VALID_HOLIDAY_TYPES = ['National', 'Company', 'Optional', 'Company Event'] as const;

type HolidayType = (typeof VALID_HOLIDAY_TYPES)[number];

const isValidHolidayType = (value: any): value is HolidayType =>
  VALID_HOLIDAY_TYPES.includes(value);

const isCalendarEventHolidayType = (type: string): boolean => type === 'Company Event';

function notifyEmployeesCalendarEventHoliday(params: {
  type: 'CalendarEventAdded' | 'CalendarEventUpdated' | 'CalendarEventRemoved';
  eventId: string;
  eventTitle: string;
  eventDate: string;
}): void {
  const copy: Record<
    typeof params.type,
    { title: string; message: string }
  > = {
    CalendarEventAdded: {
      title: 'New Company Event',
      message: `"${params.eventTitle}" was added to the company calendar for ${params.eventDate}.`,
    },
    CalendarEventUpdated: {
      title: 'Company Event Updated',
      message: `"${params.eventTitle}" on ${params.eventDate} has been updated in the company calendar.`,
    },
    CalendarEventRemoved: {
      title: 'Company Event Removed',
      message: `"${params.eventTitle}" on ${params.eventDate} has been removed from the company calendar.`,
    },
  };
  const { title, message } = copy[params.type];
  void notificationService.notifyAllEmployees({
    type: params.type,
    title,
    message,
    relatedData: {
      calendarEventId: params.eventId,
      calendarEventTitle: params.eventTitle,
      calendarEventDate: params.eventDate,
    },
  });
}

export const leaveController = {
  // GET /api/leaves
  getAll: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      let employeeId: string | undefined;

      if (isEmployeeRole(req.user?.role ?? '')) {
        const employee = await resolveEmployeeForAuthUser(req.user!.id, req.user!.email);
        employeeId = employee?.id ? String(employee.id) : req.user!.id;
      } else {
        employeeId = (req.query.employeeId as string) || undefined;
      }

      const leaves = await leaveService.getAllLeaves(employeeId);
      if (isEmployeeRole(req.user?.role ?? '')) {
        res.json(leaves.filter((l) => l.status === 'Pending'));
        return;
      }
      res.json(leaves);
    } catch {
      res.status(500).json({ error: 'Failed to fetch leaves' });
    }
  },

  // GET /api/leaves/history — approved, rejected, and employee-cancelled (not active pending)
  getHistory: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      let employeeId: string | undefined;

      if (isEmployeeRole(req.user?.role ?? '')) {
        const employee = await resolveEmployeeForAuthUser(req.user!.id, req.user!.email);
        employeeId = employee?.id ? String(employee.id) : req.user!.id;
      } else {
        employeeId = (req.query.employeeId as string) || undefined;
      }

      const leaves = await leaveService.getAllLeaves(employeeId);
      const history = leaves.filter((l) =>
        ['Approved', 'Rejected', 'Cancelled'].includes(l.status),
      );
      res.json(history);
    } catch {
      res.status(500).json({ error: 'Failed to fetch leave history' });
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

  // PATCH /api/leaves/employee/:employeeId/allocations (Admin only)
  updateEmployeeAllocations: async (req: AuthRequest, res: Response): Promise<void> => {
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

      const body = req.body as Record<string, unknown>;
      const allocations = await leaveService.updateEmployeeLeaveAllocations(employeeId, {
        'Casual Leave': body['Casual Leave'] as number | undefined,
        'Sick Leave': body['Sick Leave'] as number | undefined,
        'Earned Leave': body['Earned Leave'] as number | undefined,
      });
      res.json({ allocations });
    } catch (error: unknown) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update leave allocations',
      });
    }
  },

  // PATCH /api/leaves/employee/:employeeId/balance-adjustment (Admin only)
  adjustEmployeeBalance: async (req: AuthRequest, res: Response): Promise<void> => {
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

      const { type, delta } = req.body as { type?: string; delta?: number };
      if (delta === undefined || delta === null || Number(delta) === 0) {
        res.status(400).json({ error: 'type and a non-zero delta are required' });
        return;
      }

      const validTypes = new Set([
        'Casual Leave',
        'Sick Leave',
        'Earned Leave',
        'Compensation Leave',
      ]);
      if (!type || !validTypes.has(type)) {
        res.status(400).json({ error: 'Invalid leave type' });
        return;
      }

      const summary = await leaveService.adjustEmployeeLeaveBalance(
        employeeId,
        type as 'Casual Leave' | 'Sick Leave' | 'Earned Leave' | 'Compensation Leave',
        Number(delta),
      );
      res.json(summary);
    } catch (error: unknown) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to adjust leave balance',
      });
    }
  },

  // PATCH /api/leaves/employee/:employeeId/balance-adjustments (Admin only, batch)
  adjustEmployeeBalances: async (req: AuthRequest, res: Response): Promise<void> => {
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

      const { adjustments } = req.body as {
        adjustments?: Partial<
          Record<'Casual Leave' | 'Sick Leave' | 'Earned Leave' | 'Compensation Leave', number>
        >;
      };

      if (!adjustments || typeof adjustments !== 'object') {
        res.status(400).json({ error: 'adjustments object is required' });
        return;
      }

      const summary = await leaveService.adjustEmployeeLeaveBalances(employeeId, adjustments);
      res.json(summary);
    } catch (error: unknown) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to adjust leave balances',
      });
    }
  },

  // GET /api/leaves/year-balances?year=2026 (Admin only)
  getYearBalances: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user || !isAdminRole(req.user.role)) {
        res.status(403).json({ error: 'Forbidden: Admin access required' });
        return;
      }

      const yearParam = req.query.year;
      const year =
        yearParam !== undefined && yearParam !== ''
          ? Number(Array.isArray(yearParam) ? yearParam[0] : yearParam)
          : new Date().getFullYear();

      const data = await leaveService.getAllEmployeesYearLeaveBalances(year);
      res.json(data);
    } catch (error: unknown) {
      console.error('[leave] getYearBalances failed:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to fetch year leave balances',
      });
    }
  },

  // PATCH /api/leaves/employee/:employeeId/year-balances (Admin only)
  updateYearBalances: async (req: AuthRequest, res: Response): Promise<void> => {
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

      const { year, balances } = req.body as {
        year?: number;
        balances?: leaveService.YearLeaveBalanceUpdate[];
      };

      const calendarYear =
        year !== undefined && year !== null ? Number(year) : new Date().getFullYear();

      if (!Array.isArray(balances) || balances.length === 0) {
        res.status(400).json({ error: 'balances array is required' });
        return;
      }

      const row = await leaveService.updateEmployeeYearLeaveBalances(
        employeeId,
        calendarYear,
        balances,
        (req.user as { name?: string; email?: string })?.name ||
          (req.user as { name?: string; email?: string })?.email ||
          'Admin',
      );
      res.json(row);
    } catch (error: unknown) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update year leave balances',
      });
    }
  },

  // GET /api/leaves/allocation-activities?from=&to= (Admin only)
  getAllocationActivities: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user || !isAdminRole(req.user.role)) {
        res.status(403).json({ error: 'Forbidden: Admin access required' });
        return;
      }

      const from = typeof req.query.from === 'string' ? req.query.from : undefined;
      const to = typeof req.query.to === 'string' ? req.query.to : undefined;
      const activities = await leaveService.getLeaveAllocationActivities(from, to);
      res.json(activities);
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch leave allocation activities',
      });
    }
  },

  // POST /api/leaves
  create: async (req: AuthRequest, res: Response): Promise<void> => {
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

      let resolvedEmployeeId = String(employeeId);
      let resolvedEmployeeName =
        typeof employeeName === 'string' && employeeName.trim() ? employeeName.trim() : 'Unknown';

      if (req.user && isEmployeeRole(req.user.role)) {
        const own = await resolveEmployeeForAuthUser(req.user.id, req.user.email);
        const ownId = own?.id ? String(own.id) : req.user.id;
        if (String(employeeId) !== ownId && String(employeeId) !== req.user.id) {
          res.status(403).json({ error: 'You can only submit leave requests for your own account.' });
          return;
        }
        resolvedEmployeeId = ownId;
        if (own) {
          const name = [own.firstName, own.middleName, own.lastName].filter(Boolean).join(' ').trim();
          if (name) resolvedEmployeeName = name;
        }
      }

      const leave = await leaveService.createLeave({
        employeeId: resolvedEmployeeId,
        employeeName: resolvedEmployeeName,
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
      let employeeId: string | undefined;

      if (isEmployeeRole(req.user?.role ?? '')) {
        const employee = await resolveEmployeeForAuthUser(req.user!.id, req.user!.email);
        employeeId = employee?.id ? String(employee.id) : req.user!.id;
      } else {
        employeeId = req.query.employeeId as string;
      }

      if (!employeeId) {
        res.status(400).json({ error: 'employeeId is required' });
        return;
      }

      const balances = await leaveService.getLeaveBalances(employeeId);
      res.json(balances);
    } catch (error) {
      console.error('Error fetching leave balances:', error);
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
      const trimmed = typeof reason === 'string' ? reason.trim() : '';
      if (!trimmed) {
        res.status(400).json({ error: 'Rejection reason is required' });
        return;
      }
      if (trimmed.length > 500) {
        res.status(400).json({ error: 'Rejection reason must be under 500 characters' });
        return;
      }
      const actionBy = (req.user as any)?.name || (req.user as any)?.email || 'Admin';
      const leave = await leaveService.updateLeaveStatus(id, 'Rejected', trimmed, actionBy);
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

  // PATCH /api/leaves/:id/revoke — admin revokes approved leave with reason → Rejected
  revoke: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { reason } = req.body;
      const { id } = req.params as { id: string };
      const trimmed = typeof reason === 'string' ? reason.trim() : '';
      if (!trimmed) {
        res.status(400).json({ error: 'Rejection reason is required' });
        return;
      }
      const actionBy = (req.user as any)?.name || (req.user as any)?.email || 'Admin';
      const leave = await leaveService.revokeApprovedLeave(id, trimmed, actionBy);
      if (!leave) {
        res.status(404).json({ error: 'Approved leave not found' });
        return;
      }
      res.json(leave);
    } catch (error: any) {
      console.error('Error revoking leave:', error);
      const message = error.message || 'Failed to revoke leave';
      const isClientError =
        typeof message === 'string' &&
        (message.startsWith('Cannot revoke') ||
          message.startsWith('Rejection reason'));
      res.status(isClientError ? 400 : 500).json({ error: message });
    }
  },

  // PATCH /api/leaves/:id/cancel
  cancel: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const leave = await leaveService.getLeaveById(id);
      if (!leave) {
        res.status(404).json({ error: 'Leave not found' });
        return;
      }
      const isEmployee = req.user && isEmployeeRole(req.user.role);
      const isAdmin = req.user && isAdminRole(req.user.role);

      if (isEmployee) {
        if (leave.status !== 'Pending') {
          res.status(400).json({ error: 'You can only cancel pending leave requests.' });
          return;
        }
        const own = await resolveEmployeeForAuthUser(req.user!.id, req.user!.email);
        const ownId = own?.id ? String(own.id) : req.user!.id;
        const leaveOwner = String(leave.employeeId);
        if (leaveOwner !== ownId && leaveOwner !== req.user!.id) {
          res.status(403).json({ error: 'You can only cancel your own leave requests.' });
          return;
        }
      } else if (!isAdmin) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      } else {
        res.status(400).json({ error: 'Use revoke for approved leaves or reject for pending requests.' });
        return;
      }

      const cancelledBy = (req.user as any)?.name || (req.user as any)?.email || undefined;
      const cancelledLeave = await leaveService.cancelLeave(id, undefined, cancelledBy, {
        notifyAdmins: true,
      });
      if (!cancelledLeave) {
        res.status(500).json({ error: 'Failed to cancel leave' });
        return;
      }
      res.json(cancelledLeave);
    } catch (error: any) {
      console.error('Error cancelling leave:', error);
      const message = error.message || 'Failed to cancel leave';
      const isClientError =
        typeof message === 'string' && message.startsWith('Cannot cancel');
      res.status(isClientError ? 400 : 500).json({ error: message });
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

  // DELETE /api/leaves/:id — admin cleanup; never notifies the employee
  delete: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user || !isAdminRole(req.user.role)) {
        res.status(403).json({ error: 'Forbidden: Admin access required' });
        return;
      }
      const { id } = req.params as { id: string };
      const existing = await leaveService.getLeaveById(id);
      if (!existing) {
        res.status(404).json({ error: 'Leave not found' });
        return;
      }
      if (!leaveService.isLeaveEnded(existing)) {
        res.status(400).json({
          error: 'Only past approved leaves can be deleted from the calendar. Use revoke for active or upcoming leaves.',
        });
        return;
      }
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
      const titleText = String(title ?? '').trim();
      const dateText = String(date ?? '').trim();
      if (!titleText || !dateText) {
        res.status(400).json({ error: 'Title and date are required' });
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
        res.status(400).json({ error: 'Date must be YYYY-MM-DD' });
        return;
      }

      const holidayType = type || 'National';
      if (!isValidHolidayType(holidayType)) {
        res.status(400).json({ error: 'Invalid holiday type' });
        return;
      }
      const holiday = await leaveService.createHoliday({
        title: titleText,
        date: dateText,
        description,
        type: holidayType,
      });

      if (isCalendarEventHolidayType(holidayType)) {
        notifyEmployeesCalendarEventHoliday({
          type: 'CalendarEventAdded',
          eventId: holiday.id,
          eventTitle: titleText,
          eventDate: dateText,
        });
      } else {
        void notificationService.notifyAllEmployees({
          type: 'HolidayAdded',
          title: 'New Holiday Added',
          message: `${titleText} on ${dateText} has been added to the company calendar as a ${holidayType} holiday.`,
          relatedData: {
            holidayId: holiday.id,
            holidayTitle: titleText,
            holidayDate: dateText,
          },
        });
      }

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

      const updatedTitle = title !== undefined ? String(title).trim() : existing.title;
      const updatedDate = date !== undefined ? String(date).trim() : existing.date;
      const updatedType = type !== undefined ? type : existing.type;
      const titleChanged = updatedTitle !== existing.title;
      const dateChanged = updatedDate !== existing.date;
      const typeChanged = updatedType !== existing.type;
      const isEvent =
        isCalendarEventHolidayType(updatedType) || isCalendarEventHolidayType(existing.type);
      const shouldNotify = isEvent
        ? titleChanged || dateChanged || typeChanged
        : dateChanged || typeChanged;

      if (shouldNotify) {
        if (isCalendarEventHolidayType(updatedType)) {
          notifyEmployeesCalendarEventHoliday({
            type: 'CalendarEventUpdated',
            eventId: id,
            eventTitle: updatedTitle,
            eventDate: updatedDate,
          });
        } else {
          void notificationService.notifyAllEmployees({
            type: 'HolidayUpdated',
            title: 'Holiday Updated',
            message: `The holiday "${updatedTitle}" on ${updatedDate} has been updated in the company calendar.`,
            relatedData: {
              holidayId: id,
              holidayTitle: updatedTitle,
              holidayDate: updatedDate,
            },
          });
        }
      }

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

      if (isCalendarEventHolidayType(holiday.type)) {
        notifyEmployeesCalendarEventHoliday({
          type: 'CalendarEventRemoved',
          eventId: id,
          eventTitle: holiday.title,
          eventDate: holiday.date,
        });
      } else {
        void notificationService.notifyAllEmployees({
          type: 'HolidayDeleted',
          title: 'Holiday Removed',
          message: `"${holiday.title}" on ${holiday.date} has been removed from the company calendar.`,
          relatedData: {
            holidayId: id,
            holidayTitle: holiday.title,
            holidayDate: holiday.date,
          },
        });
      }

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
        void notificationService.notifyAllEmployees({
          type: 'HolidaySkipped',
          title: 'Holiday Marked as Working Day',
          message: `"${holiday.title}" on ${holiday.date} has been marked as a working day. The company will be operational on this date.`,
          relatedData: {
            holidayId: id,
            holidayTitle: holiday.title,
            holidayDate: holiday.date,
            skippedReason: resolvedReason,
          },
        });
      } else {
        void notificationService.notifyAllEmployees({
          type: 'HolidayUpdated',
          title: 'Holiday Restored',
          message: `"${holiday.title}" on ${holiday.date} has been restored as a holiday. Enjoy your day off!`,
          relatedData: {
            holidayId: id,
            holidayTitle: holiday.title,
            holidayDate: holiday.date,
          },
        });
      }

      res.json(updated);
    } catch {
      res.status(500).json({ error: 'Failed to toggle holiday skip status' });
    }
  },

  downloadHolidayImportTemplate: async (_req: Request, res: Response): Promise<void> => {
    try {
      const buffer = await buildHolidayImportTemplate();
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', 'attachment; filename="holiday_import_template.xlsx"');
      res.send(buffer);
    } catch (error) {
      console.error('Error building holiday import template:', error);
      res.status(500).json({ error: 'Failed to generate holiday import template' });
    }
  },

  importHolidaysFromExcel: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!isAdminRole(req.user?.role ?? '')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      if (!req.file?.buffer) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const parsedRows = await parseHolidayImportWorkbook(req.file.buffer);
      const rowErrors = parsedRows
        .filter((row) => row.errors.length > 0)
        .map((row) => ({ rowNumber: row.rowNumber, errors: row.errors }));

      const validRows = parsedRows
        .filter((row) => row.errors.length === 0)
        .map((row) => ({
          rowNumber: row.rowNumber,
          fromDate: row.fromDate,
          toDate: row.toDate,
          title: row.title,
          type: row.type,
        }));

      if (validRows.length === 0) {
        res.status(400).json({
          error: 'No valid holiday rows found in the uploaded file',
          rowErrors,
          created: [],
          skipped: [],
        });
        return;
      }

      const result = await leaveService.bulkImportHolidays(validRows, expandHolidayDates);

      const summary = result.summary.map((item) => ({
        title: item.title,
        typeLabel: holidayTypeToLabel(item.type),
        dateLabel: formatHolidaySummaryDate(item.fromDate, item.toDate),
      }));

      res.status(result.created.length > 0 ? 201 : 400).json({
        created: result.created,
        skipped: result.skipped,
        rowErrors,
        summary,
      });
    } catch (error: any) {
      console.error('Error importing holidays from Excel:', error);
      res.status(400).json({ error: error?.message || 'Failed to import holidays from Excel' });
    }
  },
};
