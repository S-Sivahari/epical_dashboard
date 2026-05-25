import { Request, Response } from 'express';
import * as employeeService from '../services/employeeService';
import { CreateEmployeePayload } from '../models/Employee';

export const employeeController = {
  // Get all employees with filtering and pagination
  getAllEmployees: async (req: Request, res: Response): Promise<void> => {
    try {
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
  getEmployeeById: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const employee = await employeeService.getEmployeeById(id);

      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      res.json(employee);
    } catch (error) {
      console.error('Error fetching employee:', error);
      res.status(500).json({ error: 'Failed to fetch employee' });
    }
  },

  // Create new employee
  createEmployee: async (req: Request, res: Response): Promise<void> => {
    try {
      const payload: CreateEmployeePayload = req.body;

        // Validate essential fields dynamically
        const required = ['firstName', 'lastName'];
        const missing = required.filter(f => !(payload as any)[f]?.toString?.()?.trim?.());
        if (missing.length) {
          res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
          return;
        }

      const employee = await employeeService.createEmployee(payload);
      res.status(201).json(employee);
    } catch (error: any) {
        // Handle validation errors from service
        if (error?.code === 'VALIDATION_ERROR') {
          res.status(400).json({ error: error.message });
          return;
        }
        // Duplicate email
        if (error?.code === 'DUPLICATE_EMAIL') {
          res.status(409).json({ error: error.message });
          return;
        }
        // Duplicate employee ID
        if (error?.code === 'DUPLICATE_EMPLOYEE_ID') {
          res.status(409).json({ error: error.message });
          return;
        }
        // MongoDB native duplicate key fallback
        if (error?.code === 11000 || error?.message?.includes('E11000')) {
          res.status(409).json({ error: 'A duplicate entry already exists.' });
          return;
        }
        console.error('Error creating employee:', error);
        res.status(500).json({ error: error?.message ?? 'Failed to create employee' });
    }
  },

  // Update employee
  updateEmployee: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const payload = req.body;

      const employee = await employeeService.updateEmployee(id, payload);

      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      res.json(employee);
    } catch (error: any) {
      if (error?.code === 'DUPLICATE_EMAIL') {
        res.status(409).json({ error: error.message });
        return;
      }
      if (error?.code === 'COMPANY_EMAIL_REQUIRED') {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error?.code === 'VALIDATION_ERROR') {
        res.status(400).json({ error: error.message });
        return;
      }
      console.error('Error updating employee:', error);
      res.status(500).json({ error: 'Failed to update employee' });
    }
  },

  // Delete employee (hard delete)
  deleteEmployee: async (req: Request, res: Response): Promise<void> => {
    try {
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
  updateStatus: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const { status } = req.body;

      if (!status) {
        res.status(400).json({ error: 'Status is required' });
        return;
      }

      const employee = await employeeService.updateEmployeeStatus(id, status);

      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      res.json(employee);
    } catch (error) {
      console.error('Error updating employee status:', error);
      res.status(500).json({ error: 'Failed to update employee status' });
    }
  },


  // Search employees
  searchEmployees: async (req: Request, res: Response): Promise<void> => {
    try {
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
  bulkUpdateStatus: async (req: Request, res: Response): Promise<void> => {
    try {
      const { ids, status } = req.body as { ids: string[]; status: string };
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: 'ids must be a non-empty array' });
        return;
      }
      if (!status) {
        res.status(400).json({ error: 'status is required' });
        return;
      }
      const result = await employeeService.bulkUpdateStatus(ids, status);
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
};
