import { Router } from 'express';
import { activityController } from '../controllers/activityController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();
const adminOnly = requireRole('Admin');

router.use(authMiddleware);

router.post('/heartbeat', activityController.postHeartbeat);
router.get('/mine/summary', activityController.getMyTodaySummary);
router.get('/employee/:employeeId/summary', adminOnly, activityController.getEmployeeSummary);

export const activityRoutes = router;
