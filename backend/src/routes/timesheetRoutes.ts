import { Router } from 'express';
import { timesheetController } from '../controllers/timesheetController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', timesheetController.getAll);
router.get('/:id', timesheetController.getById);
router.post('/', timesheetController.create);
router.put('/:id', timesheetController.update);
router.delete('/:id', timesheetController.delete);

export const timesheetRoutes = router;
