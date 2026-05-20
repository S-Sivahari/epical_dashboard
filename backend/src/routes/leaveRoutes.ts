import { Router } from 'express';
import { leaveController } from '../controllers/leaveController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// All leave routes require auth
router.use(authMiddleware);

// Balances
router.get('/balances', leaveController.getBalances);

// Leave requests
router.get('/', leaveController.getAll);
router.post('/', leaveController.create);
router.patch('/:id/approve', leaveController.approve);
router.patch('/:id/reject', leaveController.reject);
router.patch('/:id/cancel', leaveController.cancel);
router.delete('/:id', leaveController.delete);

// Holidays
router.get('/holidays', leaveController.getHolidays);
router.post('/holidays', leaveController.createHoliday);
router.delete('/holidays/:id', leaveController.deleteHoliday);

export const leaveRoutes = router;
