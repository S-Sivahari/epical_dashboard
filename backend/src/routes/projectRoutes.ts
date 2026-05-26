import { Router } from 'express';
import { projectController } from '../controllers/projectController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', projectController.getAll);
router.get('/assigned/me', projectController.getAssignedForCurrentUser);
router.get('/archived', projectController.getArchivedProjects);
router.get('/archived/:id', projectController.getArchivedProjectById);
router.delete('/archived/:id', projectController.deleteArchivedProject);
router.post('/archived/:id/restore', projectController.restoreProject);
router.post('/:id/archive', projectController.archiveProject);
router.get('/:id/assigned-tasks', projectController.getProjectAssignedTasks);
router.get('/:id/audit-trail', projectController.getAuditTrail);
router.get('/:id', projectController.getById);
router.post('/', projectController.create);
router.put('/:id', projectController.update);
router.delete('/:id', projectController.delete);
router.patch('/:id/sync-status', projectController.syncStatus);
router.patch('/:id/complete', projectController.markCompleted);
router.patch('/:id/task-approve', projectController.taskApprove);
router.patch('/:id/task-complete', projectController.taskComplete);
router.patch('/:id/assigned-tasks/:taskId/complete', projectController.assignedTaskComplete);

export const projectRoutes = router;
