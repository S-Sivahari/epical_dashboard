import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { roleMiddleware } from '../middleware/roleMiddleware';
import { companyCalendarEventController } from '../controllers/companyCalendarEventController';

const router = Router();

router.use(authMiddleware);

router.get('/', companyCalendarEventController.list);

router.post('/', roleMiddleware('Admin'), companyCalendarEventController.create);

router.put('/:id', roleMiddleware('Admin'), companyCalendarEventController.update);

router.delete('/:id', roleMiddleware('Admin'), companyCalendarEventController.remove);

export const companyCalendarEventRoutes = router;
