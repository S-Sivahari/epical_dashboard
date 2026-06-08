import { Router } from 'express';
import { employeeController } from '../controllers/employeeController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();
const adminOnly = requireRole('Admin');

router.use(authMiddleware);

router.get('/me', employeeController.getMyEmployee);

router.get('/', adminOnly, employeeController.getAllEmployees);
router.get('/search', adminOnly, employeeController.searchEmployees);
router.get('/check-id', adminOnly, employeeController.checkEmployeeId);
router.get('/daily-activity', adminOnly, employeeController.getDailyActivityLog);
router.patch('/bulk-status', adminOnly, employeeController.bulkUpdateStatus);

router.get('/:id', employeeController.getEmployeeById);

router.post('/', adminOnly, employeeController.createEmployee);
router.put('/:id', adminOnly, employeeController.updateEmployee);
router.patch('/:id/status', adminOnly, employeeController.updateStatus);
router.delete('/:id', adminOnly, employeeController.deleteEmployee);

export const employeeRoutes = router;
