import { Router } from 'express';
import { leaveController } from '../controllers/leaveController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', leaveController.getHolidays);
router.post('/', leaveController.createHoliday);
router.delete('/:id', leaveController.deleteHoliday);

export const holidayRoutes = router;
