import { Router } from 'express';
import { leaveController } from '../controllers/leaveController';
import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';

const router = Router();

router.use(authMiddleware);

// Public endpoints (authenticated users can view)
router.get('/', leaveController.getHolidays);

// Admin-only endpoints
router.post('/', roleMiddleware('Admin'), leaveController.createHoliday);
router.put('/:id', roleMiddleware('Admin'), leaveController.updateHoliday);
router.delete('/:id', roleMiddleware('Admin'), leaveController.deleteHoliday);

export const holidayRoutes = router;
