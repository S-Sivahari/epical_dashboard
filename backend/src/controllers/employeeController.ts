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
      const department = req.query.department as string | undefined;
      const employmentType = req.query.employmentType as string | undefined;
      const status = req.query.status as string | undefined;
      const sortColumn = req.query.sortColumn as string | undefined;
      const sortDirection = req.query.sortDirection as 'asc' | 'desc' | undefined;

      const result = await employeeService.getAllEmployees(page, pageSize, {
        q,
        department,
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
      const { id } = req.params;
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

      if (!payload.employeeId || !payload.firstName || !payload.lastName || !payload.email || !payload.department || !payload.permanentAddress || !payload.communicationAddress || !payload.pan) {
        res.status(400).json({ error: 'Missing required fields: employeeId, firstName, lastName, email, department, permanentAddress, communicationAddress, pan' });
        return;
      }

      const employee = await employeeService.createEmployee(payload);
      res.status(201).json(employee);
    } catch (error: any) {
      if (error?.code === 'DUPLICATE_EMAIL') {
        res.status(409).json({ error: error.message });
        return;
      }
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
      const { id } = req.params;
      const payload = req.body;

      const employee = await employeeService.updateEmployee(id, payload);

      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      res.json(employee);
    } catch (error) {
      console.error('Error updating employee:', error);
      res.status(500).json({ error: 'Failed to update employee' });
    }
  },

  // Delete employee (hard delete)
  deleteEmployee: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
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
      const { id } = req.params;
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

  // Get employees by department
  getEmployeesByDepartment: async (req: Request, res: Response): Promise<void> => {
    try {
      const { department } = req.params;
      const employees = await employeeService.getEmployeesByDepartment(department);
      res.json(employees);
    } catch (error) {
      console.error('Error fetching employees by department:', error);
      res.status(500).json({ error: 'Failed to fetch employees' });
    }
  },
};
