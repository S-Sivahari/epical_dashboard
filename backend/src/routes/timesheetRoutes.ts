import { Router } from 'express';
import { timesheetController } from '../controllers/timesheetController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', timesheetController.getAll);
router.get('/hours-by-project', timesheetController.getHoursByProject);
router.get('/employee-hours', timesheetController.getEmployeeHours);
router.get('/:id', timesheetController.getById);
router.post('/', timesheetController.create);
router.put('/:id', timesheetController.update);
router.patch('/:id/override', timesheetController.override);
router.delete('/:id', timesheetController.delete);

export const timesheetRoutes = router;
