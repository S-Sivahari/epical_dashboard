import { Request, Response } from 'express';
import * as employeeService from '../services/employeeService';
import { CreateEmployeePayload } from '../models/Employee';
import { AuthRequest } from '../middleware/authMiddleware';
import { isAdminRole, isEmployeeRole } from '../utils/generateToken';
import { resolveEmployeeForAuthUser, employeeBelongsToAuthUser, findEmployeeByLoginEmail } from '../utils/employeeAuth';
import { sanitizeEmployeeForDetail } from '../utils/sanitizeEmployee';
import { sendEmployeeWriteError } from '../utils/employeeWriteErrors';
import {
  buildEmployeeImportTemplate,
  parseEmployeeImportWorkbook,
} from '../utils/employeeImportExcel';

export const employeeController = {
  getDailyActivityLog: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!isAdminRole(req.user?.role ?? '')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const date =
        typeof req.query.date === 'string' && req.query.date.trim()
          ? req.query.date.trim()
          : new Date().toISOString().split('T')[0];
      const entries = await employeeService.getDailyActivityLog(date);
      res.json({ date, entries });
    } catch (error) {
      console.error('Error fetching daily activity log:', error);
      res.status(500).json({ error: 'Failed to fetch activity log' });
    }
  },

  // Get all employees with filtering and pagination
  getAllEmployees: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!isAdminRole(req.user?.role ?? '')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.max(1, parseInt(req.query.pageSize as string) || 10);
      const q = req.query.q as string | undefined;
      const employmentType = req.query.employmentType as string | undefined;
      const status = req.query.status as string | undefined;
      const sortColumn = req.query.sortColumn as string | undefined;
      const sortDirection = req.query.sortDirection as 'asc' | 'desc' | undefined;

      const result = await employeeService.getAllEmployees(page, pageSize, {
        q,
        employmentType,
        status,
        sortColumn,
        sortDirection,
      });

      res.json({
        data: result.data,
        total: result.total,
        page,
        pageSize,
      });
    } catch (error) {
      console.error('Error fetching employees:', error);
      res.status(500).json({ error: 'Failed to fetch employees' });
    }
  },

  // Get employee by ID
  getEmployeeById: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const rawId = req.params.id;
      const id = String(Array.isArray(rawId) ? rawId[0] : rawId ?? '').trim();
      const employee = await employeeService.getEmployeeProfileById(id);

      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      if (isEmployeeRole(req.user?.role ?? '')) {
        const allowed = await employeeBelongsToAuthUser(
          employee,
          req.user!.id,
          req.user!.email,
        );
        if (!allowed) {
          res.status(403).json({ error: 'Forbidden' });
          return;
        }
      }

      res.json(sanitizeEmployeeForDetail(employee));
    } catch (error) {
      console.error('Error fetching employee:', error);
      res.status(500).json({ error: 'Failed to fetch employee' });
    }
  },

  // Logged-in employee's own profile (resolves by token + email — avoids stale user.id)
  getMyEmployee: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      let own =
        (await resolveEmployeeForAuthUser(req.user.id, req.user.email)) ??
        (req.user.email ? await findEmployeeByLoginEmail(req.user.email) : null);

      if (!own) {
        res.status(404).json({ error: 'Employee profile not found for this account' });
        return;
      }

      const employee = await employeeService.getEmployeeProfileById(own.id);
      if (!employee) {
        res.status(404).json({ error: 'Employee profile not found' });
        return;
      }

      res.json(sanitizeEmployeeForDetail(employee));
    } catch (error) {
      console.error('Error fetching own employee profile:', error);
      res.status(500).json({ error: 'Failed to fetch employee profile' });
    }
  },

  // Create new employee
  createEmployee: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!isAdminRole(req.user?.role ?? '')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const payload: CreateEmployeePayload = req.body;
      const employee = await employeeService.createEmployee(payload);
      const profile = await employeeService.getEmployeeProfileById(employee.id);
      res.status(201).json(sanitizeEmployeeForDetail((profile ?? employee) as any));
    } catch (error: any) {
      sendEmployeeWriteError(res, error, 'Failed to create employee', 'Error creating employee:');
    }
  },

  // Update employee
  updateEmployee: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!isAdminRole(req.user?.role ?? '')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const { id } = req.params as { id: string };
      const changedBy = req.user?.email || req.body?.changedBy || 'Admin';
      const employee = await employeeService.updateEmployee(id, req.body, { changedBy });

      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      const profile = await employeeService.getEmployeeProfileById(id);
      res.json(sanitizeEmployeeForDetail((profile ?? employee) as any));
    } catch (error: any) {
      sendEmployeeWriteError(res, error, 'Failed to update employee', 'Error updating employee:');
    }
  },

  // Delete employee (hard delete)
  deleteEmployee: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!isAdminRole(req.user?.role ?? '')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const { id } = req.params as { id: string };
      const success = await employeeService.deleteEmployee(id);

      if (!success) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      res.json({ message: 'Employee deleted successfully' });
    } catch (error) {
      console.error('Error deleting employee:', error);
      res.status(500).json({ error: 'Failed to delete employee' });
    }
  },

  // Update employee status (Deactivate/Archive)
  updateStatus: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!isAdminRole(req.user?.role ?? '')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const { id } = req.params as { id: string };
      const { status, reason } = req.body as { status?: string; reason?: string };

      if (!status) {
        res.status(400).json({ error: 'Status is required' });
        return;
      }

      const employee = await employeeService.updateEmployeeStatus(id, status as any, {
        reason,
        changedBy: req.user?.email || 'Admin',
      });

      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      res.json(sanitizeEmployeeForDetail(employee));
    } catch (error) {
      console.error('Error updating employee status:', error);
      res.status(500).json({ error: 'Failed to update employee status' });
    }
  },


  // Search employees
  searchEmployees: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!isAdminRole(req.user?.role ?? '')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const { q } = req.query;

      if (!q) {
        res.status(400).json({ error: 'Search query required' });
        return;
      }

      const employees = await employeeService.searchEmployees(q as string);
      res.json(employees);
    } catch (error) {
      console.error('Error searching employees:', error);
      res.status(500).json({ error: 'Failed to search employees' });
    }
  },

  // Bulk update status for multiple employees
  bulkUpdateStatus: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!isAdminRole(req.user?.role ?? '')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const { ids, status, reason } = req.body as { ids: string[]; status: string; reason?: string };
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: 'ids must be a non-empty array' });
        return;
      }
      if (!status) {
        res.status(400).json({ error: 'status is required' });
        return;
      }
      if (!reason?.trim()) {
        res.status(400).json({ error: 'Reason is required for bulk status change' });
        return;
      }
      const result = await employeeService.bulkUpdateStatus(ids, status, {
        reason: reason.trim(),
        changedBy: req.user?.email || 'Admin',
      });
      res.json(result);
    } catch (error) {
      console.error('Error bulk updating employee status:', error);
      res.status(500).json({ error: 'Failed to bulk update status' });
    }
  },

  // Check if an employee ID already exists
  checkEmployeeId: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = (req.query.id as string) || '';
      const excludeId = (req.query.excludeId as string) || undefined;
      if (!id) {
        res.json({ exists: false });
        return;
      }
      const exists = await employeeService.checkEmployeeIdExists(id, excludeId);
      res.json({ exists });
    } catch (error) {
      console.error('Error checking employee ID:', error);
      res.status(500).json({ error: 'Failed to check employee ID' });
    }
  },

  downloadImportTemplate: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!isAdminRole(req.user?.role ?? '')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const buffer = await buildEmployeeImportTemplate();
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', 'attachment; filename="employee_import_template.xlsx"');
      res.send(buffer);
    } catch (error) {
      console.error('Error building employee import template:', error);
      res.status(500).json({ error: 'Failed to generate employee import template' });
    }
  },

  parseImportUpload: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!isAdminRole(req.user?.role ?? '')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      if (!req.file?.buffer) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      const rows = await parseEmployeeImportWorkbook(req.file.buffer);
      res.json({
        rows: rows.map((row) => ({
          rowNumber: row.rowNumber,
          payload: row.payload,
          errors: row.errors,
        })),
      });
    } catch (error: any) {
      console.error('Error parsing employee import file:', error);
      res.status(400).json({ error: error?.message || 'Failed to parse employee import file' });
    }
  },

  bulkCreateEmployees: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!isAdminRole(req.user?.role ?? '')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const employees = req.body?.employees;
      if (!Array.isArray(employees) || employees.length === 0) {
        res.status(400).json({ error: 'employees array is required' });
        return;
      }
      const result = await employeeService.bulkCreateEmployees(employees as CreateEmployeePayload[]);
      res.status(result.failed.length && !result.created.length ? 400 : 201).json(result);
    } catch (error) {
      console.error('Error bulk creating employees:', error);
      res.status(500).json({ error: 'Failed to bulk create employees' });
    }
  },
};
