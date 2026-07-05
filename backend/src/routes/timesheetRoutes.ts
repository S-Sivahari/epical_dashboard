import { Router } from 'express';
import { timesheetController } from '../controllers/timesheetController';
import { employeeTimesheetController } from '../controllers/employeeTimesheetController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();
const adminOnly = requireRole('Admin');

router.use(authMiddleware);

router.get('/mine/bootstrap', employeeTimesheetController.getBootstrap);
router.get('/mine/assigned-tasks', employeeTimesheetController.getMyAssignedTasks);
router.get('/mine/attendance', employeeTimesheetController.getMyAttendance);
router.get('/mine/attendance-history', employeeTimesheetController.getMyAttendanceHistory);
router.get('/mine/active', employeeTimesheetController.getMyActiveTask);
router.get('/mine/sessions', employeeTimesheetController.getMySessions);
router.get('/mine/project-wise-hours', employeeTimesheetController.getMyProjectWiseHours);
router.get('/mine/session-status', employeeTimesheetController.getMySessionStatus);
router.get('/mine/current-elapsed', employeeTimesheetController.getCurrentElapsed);
router.post('/mine/check-in', employeeTimesheetController.checkIn);
router.post('/mine/check-out', employeeTimesheetController.checkOut);
router.post('/mine/start-task', employeeTimesheetController.startTask);
router.get('/mine/startable-cells', employeeTimesheetController.getStartableCells);
router.post('/mine/start-cell-work', employeeTimesheetController.startCellWork);
router.patch('/mine/stop-task', employeeTimesheetController.stopActiveTask);
router.patch('/mine/pause-task', employeeTimesheetController.pauseActiveTask);
router.patch('/mine/resume-task', employeeTimesheetController.resumeActiveTask);
router.patch('/mine/complete-task', employeeTimesheetController.completeActiveTask);
router.post('/mine/start-break', employeeTimesheetController.startBreak);
router.post('/mine/end-break', employeeTimesheetController.endBreak);

router.get('/auto-checkout-settings', adminOnly, employeeTimesheetController.getAutoCheckoutSettings);
router.put('/auto-checkout-settings', adminOnly, employeeTimesheetController.updateAutoCheckoutSettings);

router.get('/', adminOnly, timesheetController.getAll);
router.get('/work-sessions', adminOnly, timesheetController.getWorkSessions);
router.get('/project-hours-chart', adminOnly, timesheetController.getProjectHoursChart);
router.get('/hours-by-project', adminOnly, timesheetController.getHoursByProject);
router.get('/employee-hours', adminOnly, timesheetController.getEmployeeHours);
router.get('/:id', adminOnly, timesheetController.getById);
router.post('/', adminOnly, timesheetController.create);
router.put('/:id', adminOnly, timesheetController.update);
router.patch('/:id/override', adminOnly, timesheetController.override);
router.delete('/:id', adminOnly, timesheetController.delete);

export const timesheetRoutes = router;
