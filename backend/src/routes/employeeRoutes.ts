import { Router } from 'express';
import { employeeController } from '../controllers/employeeController';

const router = Router();

// Get all employees with filtering and pagination
router.get('/', employeeController.getAllEmployees);

// Search employees
router.get('/search', employeeController.searchEmployees);

// Get employees by department
router.get('/department/:department', employeeController.getEmployeesByDepartment);

// Get employee by ID
router.get('/:id', employeeController.getEmployeeById);

// Create new employee
router.post('/', employeeController.createEmployee);

// Update employee
router.put('/:id', employeeController.updateEmployee);

// Delete employee
router.delete('/:id', employeeController.deleteEmployee);

export const employeeRoutes = router;
