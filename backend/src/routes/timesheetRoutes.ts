import { Router } from 'express';
import { timesheetController } from '../controllers/timesheetController';
import { employeeTimesheetController } from '../controllers/employeeTimesheetController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', timesheetController.getAll);
router.get('/hours-by-project', timesheetController.getHoursByProject);
router.get('/employee-hours', timesheetController.getEmployeeHours);

router.get('/mine/assigned-tasks', employeeTimesheetController.getMyAssignedTasks);
router.get('/mine/attendance', employeeTimesheetController.getMyAttendance);
router.get('/mine/active', employeeTimesheetController.getMyActiveTask);
router.get('/mine/sessions', employeeTimesheetController.getMySessions);
router.post('/mine/check-in', employeeTimesheetController.checkIn);
router.post('/mine/check-out', employeeTimesheetController.checkOut);
router.post('/mine/start-task', employeeTimesheetController.startTask);
router.patch('/mine/stop-task', employeeTimesheetController.stopActiveTask);

router.get('/:id', timesheetController.getById);
router.post('/', timesheetController.create);
router.put('/:id', timesheetController.update);
router.patch('/:id/override', timesheetController.override);
router.delete('/:id', timesheetController.delete);

export const timesheetRoutes = router;
