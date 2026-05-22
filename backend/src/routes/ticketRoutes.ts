import { Router } from 'express';
import { ticketController } from '../controllers/ticketController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', ticketController.getAll);
router.get('/project/:projectId', ticketController.getByProjectId);
router.get('/:id', ticketController.getById);
router.post('/', ticketController.create);
router.patch('/:id/status', ticketController.updateStatus);
router.delete('/:id', ticketController.delete);

export const ticketRoutes = router;
