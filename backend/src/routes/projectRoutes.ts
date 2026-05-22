import { Router } from 'express';
import { projectController } from '../controllers/projectController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', projectController.getAll);
router.get('/assigned/me', projectController.getAssignedForCurrentUser);
router.get('/:id', projectController.getById);
router.post('/', projectController.create);
router.put('/:id', projectController.update);
router.delete('/:id', projectController.delete);
router.patch('/:id/sync-status', projectController.syncStatus);
router.patch('/:id/complete', projectController.markCompleted);
router.patch('/:id/task-approve', projectController.taskApprove);
router.patch('/:id/task-complete', projectController.taskComplete);

export const projectRoutes = router;
