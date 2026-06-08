import { Router } from 'express';
import { leaveController } from '../controllers/leaveController';
import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';

const router = Router();

// All leave routes require auth
router.use(authMiddleware);

// Balances
router.get('/balances', leaveController.getBalances);

// Team leaves (all approved leaves for current month — for calendar team view)
router.get('/team', leaveController.getTeamLeaves);

// Employee leave summary for admin review (must be before /:id routes)
router.get(
  '/employee/:employeeId/summary',
  roleMiddleware('Admin'),
  leaveController.getEmployeeSummary
);
router.patch(
  '/employee/:employeeId/allocations',
  roleMiddleware('Admin'),
  leaveController.updateEmployeeAllocations
);

// Leave requests
router.get('/history', leaveController.getHistory);
router.get('/', leaveController.getAll);
router.post('/', leaveController.create);
router.delete('/all', roleMiddleware('Admin'), leaveController.deleteAll);
router.patch('/:id/approve', roleMiddleware('Admin'), leaveController.approve);
router.patch('/:id/reject', roleMiddleware('Admin'), leaveController.reject);
router.patch('/:id/revoke', roleMiddleware('Admin'), leaveController.revoke);
router.patch('/:id/cancel', leaveController.cancel);
router.delete('/:id', roleMiddleware('Admin'), leaveController.delete);

// Holidays (prefer /api/holidays for admin writes; these mirror read access)
router.get('/holidays', leaveController.getHolidays);
router.post('/holidays', roleMiddleware('Admin'), leaveController.createHoliday);
router.put('/holidays/:id', roleMiddleware('Admin'), leaveController.updateHoliday);
router.patch('/holidays/:id/skip', roleMiddleware('Admin'), leaveController.skipHoliday);
router.delete('/holidays/:id', roleMiddleware('Admin'), leaveController.deleteHoliday);

export const leaveRoutes = router;
