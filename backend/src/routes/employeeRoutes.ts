import { Router } from 'express';
import { employeeController } from '../controllers/employeeController';

const router = Router();

// Get all employees with filtering and pagination
router.get('/', employeeController.getAllEmployees);

// Search employees
router.get('/search', employeeController.searchEmployees);

// Check if employee ID exists
router.get('/check-id', employeeController.checkEmployeeId);

// Bulk update status for multiple employees
router.patch('/bulk-status', employeeController.bulkUpdateStatus);

// Get employee by ID
router.get('/:id', employeeController.getEmployeeById);

// Create new employee
router.post('/', employeeController.createEmployee);

// Update employee
router.put('/:id', employeeController.updateEmployee);

// Update employee status (Deactivate/Archive)
router.patch('/:id/status', employeeController.updateStatus);

// Delete employee
router.delete('/:id', employeeController.deleteEmployee);


export const employeeRoutes = router;
