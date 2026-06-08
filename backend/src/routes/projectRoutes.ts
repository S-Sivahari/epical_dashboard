import { Router } from 'express';
import { projectController } from '../controllers/projectController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();
const adminOnly = requireRole('Admin');

router.use(authMiddleware);

router.get('/assigned/me', projectController.getAssignedForCurrentUser);

router.get('/', adminOnly, projectController.getAll);
router.get('/archived', adminOnly, projectController.getArchivedProjects);
router.get('/archived/:id', adminOnly, projectController.getArchivedProjectById);
router.delete('/archived/:id', adminOnly, projectController.deleteArchivedProject);
router.post('/archived/:id/restore', adminOnly, projectController.restoreProject);
router.post('/:id/archive', adminOnly, projectController.archiveProject);
router.get('/:id/assigned-tasks', adminOnly, projectController.getProjectAssignedTasks);
router.get('/:id/audit-trail', adminOnly, projectController.getAuditTrail);
router.get('/:id', adminOnly, projectController.getById);
router.post('/', adminOnly, projectController.create);
router.put('/:id', adminOnly, projectController.update);
router.delete('/:id', adminOnly, projectController.delete);
router.patch('/:id/sync-status', adminOnly, projectController.syncStatus);
router.patch('/:id/complete', adminOnly, projectController.markCompleted);
router.patch('/:id/task-approve', adminOnly, projectController.taskApprove);
router.patch('/:id/task-complete', adminOnly, projectController.taskComplete);
router.patch('/:id/assigned-tasks/:taskId/complete', adminOnly, projectController.assignedTaskComplete);

export const projectRoutes = router;
